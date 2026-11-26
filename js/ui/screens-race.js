// RACE (HUD, pause, touch controls) and RESULTS
import { UI, Focus, $, $$, esc, dialog, toast, sleep, footer } from './core.js';
import { App } from '../app.js';
import { Audio } from '../audio/audio.js';
import { Input } from '../core/input.js';
import { Save, rankOf } from '../core/save.js';
import { Race } from '../game/race.js';
import { COURSES, courseById } from '../data/courses.js';
import { CARS, buildSpec } from '../data/cars.js';
import { fmt, fmtDelta } from '../game/hud.js';

UI.register({
  id: 'race',
  build(n) {
    n.innerHTML = `
      <div class="hud-top"><div class="lbl">TIME</div><div class="time">0'00"000</div><div class="delta"></div></div>
      <div class="hud-left"><div class="hud-panel"><small>BEST</small><b class="h-best">--</b></div><div class="hud-panel"><small>SECTIONS</small><div class="secs"></div></div></div>
      <div class="hud-pos"><b class="h-pos">1</b><span class="h-suf">st</span><div class="gap"></div></div>
      <div class="hud-lap"></div>
      <canvas id="minimap"></canvas><canvas id="tacho"></canvas>
      <div class="hud-drift"></div><div class="hud-sec"></div><div class="hud-warn">WRONG WAY  — R でコース復帰</div><div class="hud-msg"></div>
      <div class="touch">
        <div class="tbtn l" data-t="left">◀</div><div class="tbtn r" data-t="right">▶</div>
        <div class="tbtn acc" data-t="acc">ACCEL</div><div class="tbtn brk" data-t="brk">BRAKE</div><div class="tbtn hb" data-t="hb">S.BRAKE</div>
        <div class="tbtn pause" data-t="pause">II</div></div>
      <div class="pause-menu"><div class="box"><h2>PAUSE</h2><button class="btn primary">RESUME</button><button class="btn">RETRY</button><button class="btn">SETTINGS (CAMERA C)</button><button class="btn dark">QUIT</button></div></div>`;
    // touch buttons
    $$('.tbtn', n).forEach(b => {
      const k = b.dataset.t;
      const on = (e) => { e.preventDefault(); Audio.unlock(); if (k === 'pause') return this.togglePause(); Input.touch[k] = 1; b.classList.add('on'); };
      const off = (e) => { e.preventDefault(); if (k !== 'pause') { Input.touch[k] = 0; b.classList.remove('on'); } };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    });
  },
  enter(params) {
    this.params = params;
    const gc = Save.activeCar;
    const spec = App.specOf(gc);
    const course = courseById(params.courseId);
    const rec = Save.profile.records[`${params.courseId}:${params.dir}`];
    const rivals = [];
    if (params.mode === 'battle') {
      // rival: a different car with tuning scaled by CPU level
      const pool = CARS.filter(c => c.id !== gc.carId);
      const rc = pool[Math.floor(Math.random() * pool.length)];
      const lvl = params.cpu || { skill: 0.9, aggr: 0.45 };
      const t = Math.round((lvl.skill - 0.8) * 15);
      rivals.push({ spec: buildSpec(rc, { engine: t, tires: t, weight: t, suspension: t }), dress: { paint: ['red', 'black', 'blue', 'silver'][Math.floor(Math.random() * 4)], wheel: 'gold6', spoiler: 'mid', aero: 'street', decal: 'number', number: '99' }, skill: lvl.skill, aggr: lvl.aggr, name: rc.name });
    }
    const hud = {
      root: this.el, time: $('.time', this.el), delta: $('.delta', this.el), best: $('.h-best', this.el), secs: $('.secs', this.el),
      pos: $('.hud-pos', this.el), posNum: $('.h-pos', this.el), posSuf: $('.h-suf', this.el), gap: $('.gap', this.el), lap: $('.hud-lap', this.el),
      tacho: $('#tacho', this.el), minimap: $('#minimap', this.el), drift: $('.hud-drift', this.el), sec: $('.hud-sec', this.el), warn: $('.hud-warn', this.el), msg: $('.hud-msg', this.el),
    };
    hud.delta.textContent = ''; hud.warn.style.display = 'none';
    const start = async () => {
      const ghost = params.mode === 'trial' ? await Save.loadGhost(params.courseId, params.dir) : null;
      this.race = new Race(App.gfx, {
        mode: params.mode, courseId: params.courseId, dir: params.dir, weather: params.weather,
        player: { spec, dress: gc.dress, name: Save.profile.driverName }, rivals, ghost, best: rec, hud,
        settings: App.settings, onFinish: (res) => this.finish(res),
      });
      App.race = this.race;
      App.gfx.setView({ scene: this.race.scene, camera: this.race.camera, update: (dt) => this.race.update(dt) });
      this.race.start();
    };
    Audio.stopMusic(0.3);
    const touchOn = App.settings.touch === 'on' || (App.settings.touch === 'auto' && App.isTouch);
    $('.touch', this.el).classList.toggle('on', touchOn);
    $('.pause-menu', this.el).classList.remove('on');
    const btns = $$('.pause-menu .btn', this.el);
    this.pf = new Focus(btns, { axis: 'v', onSelect: (i) => this.pauseAct(i) });
    this.cleanup();
    return start();
  },
  cleanup() { if (this.race) { this.race.dispose(); this.race = null; App.race = null; } },
  leave() { this.cleanup(); Object.keys(Input.touch).forEach(k => Input.touch[k] = 0); },
  togglePause() {
    if (!this.race || this.race.state === 'finish') return;
    const on = !this.race.paused; this.race.setPaused(on);
    $('.pause-menu', this.el).classList.toggle('on', on);
    Audio.ui(on ? 'ok' : 'back');
  },
  async pauseAct(i) {
    if (i === 0) return this.togglePause();
    if (i === 1) { Audio.ui('ok'); this.cleanup(); return UI.go('race', this.params, { wipe: true }); }
    if (i === 2) { this.race.camMode = (this.race.camMode + 1) % 3; App.settings.camera = this.race.camMode; Audio.ui('move'); return; }
    if (i === 3) { Audio.ui('back'); this.cleanup(); Audio.stopEngines(); return UI.go(this.params.event ? 'special' : 'course'); }
  },
  async finish(res) {
    const p = Save.profile; const gc = Save.activeCar;
    const key = `${res.courseId}:${res.dir}`;
    const prev = p.records[key];
    let credits = 0, rp = 0, newRecord = false;
    const km = Math.max(0, res.distance) / 1000;
    p.stats.races++; p.stats.km += km; gc.races = (gc.races || 0) + 1; gc.km = (gc.km || 0) + km;
    if (res.time != null && (res.mode === 'trial')) {
      p.stats.trials++;
      credits += 300 + Math.round(km * 60); rp += 40;
      if (!prev || res.time < prev.best) {
        newRecord = true; credits += prev ? 500 : 200; rp += prev ? 60 : 20;
        p.records[key] = { best: res.time, sections: res.sections, carId: gc.carId, car: gc.name, date: Date.now() };
        await Save.saveGhost(res.courseId, res.dir, res.ghost);
      }
    }
    if (res.mode === 'battle') {
      p.stats.battles = (p.stats.battles || 0) + 1;
      const lvl = this.params.cpu || { reward: 700 };
      if (res.won) { p.stats.wins++; credits += lvl.reward; rp += 120; } else { credits += Math.round(lvl.reward * 0.25); rp += 25; }
      if (res.time != null && (!prev || res.time < prev.best)) { newRecord = true; p.records[key] = { best: res.time, sections: res.sections, carId: gc.carId, car: gc.name, date: Date.now() }; }
    }
    let event = null;
    if (this.params.event && res.time != null) {
      const e = this.params.event; p.flags.events ||= {};
      const st = p.flags.events[e.id] ||= { best: null, cleared: false };
      if (st.best == null || res.time < st.best) st.best = res.time;
      if (res.time <= e.target && !st.cleared) { st.cleared = true; credits += e.reward; rp += 150; event = { cleared: true, reward: e.reward }; }
      else event = { cleared: res.time <= e.target, reward: 0 };
    }
    const rankBefore = rankOf(p.rp);
    p.credits += credits; p.rp += rp; p.xp += rp;
    // unlocks
    const unlocked = [];
    for (const c of COURSES) if (c.unlock && !p.unlocked.courses.includes(c.id) && p.rp >= c.unlock.rp) { p.unlocked.courses.push(c.id); unlocked.push(c.jp); }
    await Save.persistNow('race-end');
    UI.go('result', { res, prev, newRecord, credits, rp, rankBefore, rankAfter: rankOf(p.rp), unlocked, event, params: this.params });
  },
  onAction(a) {
    if (!this.race) return;
    if (a === 'back') return this.togglePause();
    if (this.race.paused) this.pf.action(a);
  },
});

UI.register({
  id: 'result',
  build(n) { n.innerHTML = `<div class="bg-metal" style="opacity:.88"></div><div class="topbar" style="padding-left:60px"><div class="title r-title">RESULT</div><div class="jp r-course"></div></div>
    <div class="res-head"></div><div class="res-table"></div><div class="res-btns"></div>${footer([['←→', '選択'], ['ENTER', '決定']])}`; },
  enter(d) {
    const { res, prev, newRecord } = d; const c = courseById(res.courseId);
    Audio.playMusic('result'); Audio.stopEngines();
    $('.r-title', this.el).textContent = res.mode === 'battle' ? 'BATTLE RESULT' : d.event ? 'EVENT RESULT' : 'TIME ATTACK RESULT';
    $('.r-course', this.el).textContent = `${c.jp} ${c.dirs[res.dir][1]}`;
    const head = res.mode === 'battle'
      ? `<div class="t">${res.won ? 'YOU WIN' : 'YOU LOSE'}</div><div class="big" style="color:${res.won ? '#ffd400' : '#ff4a4a'}">${res.won ? 'WIN!!' : 'LOSE'}</div>${res.time != null ? `<div style="font-size:44px;font-style:italic">${fmt(res.time)}</div>` : '<div style="font-size:34px;font-style:italic;color:#aaa">ライバルに大差をつけられた…</div>'}`
      : `<div class="t">TOTAL TIME</div><div class="big">${fmt(res.time)}</div>${newRecord ? '<div class="nr">NEW RECORD!!</div>' : prev ? `<div style="font-size:40px;font-style:italic;color:#ff6a6a">${fmtDelta(res.time - prev.best)}</div>` : ''}`;
    $('.res-head', this.el).innerHTML = head;
    const secs = res.sections.map((t, i) => { const b = prev?.sections?.[i]; return `<div class="r"><span>SECTION ${i + 1}</span><span>${fmt(t)} ${b != null ? `<span class="${t < b ? 'g' : ''}" style="color:${t < b ? '#3dff8a' : '#ff6a6a'};font-size:22px">${fmtDelta(t - b)}</span>` : ''}</span></div>`; }).join('');
    const ev = d.event ? `<div class="r"><span>EVENT</span><span class="${d.event.cleared ? 'g' : ''}">${d.event.cleared ? 'CLEAR!' : 'FAILED'} (目標 ${fmt(d.params.event.target)})</span></div>` : '';
    $('.res-table', this.el).innerHTML = `
      <div class="res-box"><h3>SECTION TIMES</h3>${secs || '<div class="r"><span>—</span></div>'}<div class="r"><span>PERSONAL BEST</span><span class="y">${fmt(Save.profile.records[`${res.courseId}:${res.dir}`]?.best)}</span></div></div>
      <div class="res-box"><h3>REWARDS</h3>${ev}<div class="r"><span>CREDITS</span><span class="y">+¥${d.credits.toLocaleString()}</span></div><div class="r"><span>RANK POINT</span><span class="g">+${d.rp} RP</span></div>
        <div class="r"><span>RANK</span><span>${d.rankBefore.label} → <b style="color:#ffd400">${d.rankAfter.label}</b></span></div><div class="xpbar"><i style="width:0"></i></div>
        ${d.unlocked.length ? `<div class="r"><span>UNLOCK</span><span class="g">${d.unlocked.join(', ')} 解放!</span></div>` : ''}
        <div class="r"><span>TOTAL</span><span class="y">¥${Save.profile.credits.toLocaleString()}</span></div></div>`;
    setTimeout(() => { const x = $('.xpbar i', this.el); if (x) x.style.width = (d.rankAfter.progress * 100) + '%'; }, 200);
    if (d.rankAfter.label !== d.rankBefore.label) setTimeout(() => { toast(`RANK UP!! ${d.rankAfter.label}`); Audio.ui('start'); }, 900);
    const btns = d.params.event ? [['RETRY', 'retry', 'primary'], ['EVENT LIST', 'special', ''], ['MODE SELECT', 'mode', 'dark']] : [['RETRY', 'retry', 'primary'], ['COURSE SELECT', 'course', ''], ['GARAGE', 'garage', ''], ['MODE SELECT', 'mode', 'dark']];
    $('.res-btns', this.el).innerHTML = btns.map(([l, a, c]) => `<button class="btn ${c}" data-a="${a}">${l}</button>`).join('');
    this.d = d;
    this.focus = new Focus($$('.res-btns .btn', this.el), { axis: 'h', onSelect: (i, b) => { Audio.ui('ok'); const a = b.dataset.a; if (a === 'retry') UI.go('race', d.params); else UI.go(a); } });
    if (newRecord) Audio.ui('coin');
  },
  onAction(a) { if (a === 'back') return; this.focus.action(a); },
});
