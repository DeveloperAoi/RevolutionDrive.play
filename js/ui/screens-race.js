// RACE (HUD, pause, touch controls) and RESULTS
import { UI, Focus, $, $$, esc, dialog, toast, sleep, footer, startTimer, stopTimer } from './core.js';
import { backdrop, plate, consoleBox, logoMark, keyGuide } from './frame.js';
import { tuneLevel } from './screens-menu.js';
import { idb } from '../core/save.js';
import * as Net from '../net/firebase.js';
import { targetTimes } from '../game/racehud.js';
import { App } from '../app.js';
import { Audio } from '../audio/audio.js';
import { Input } from '../core/input.js';
import { Save, rankOf } from '../core/save.js';
import { Race } from '../game/race.js';
import { COURSES, courseById } from '../data/courses.js';
import { CARS, buildSpec, carById } from '../data/cars.js';
import { fmt, fmtDelta } from '../game/hud.js';
const RIVAL_NAMES = [['ハヤト', 'MIDNIGHT WOLVES', 2], ['リン', 'SKYLINE ANGELS', 4], ['ゴウ', 'IRON RIDGE', 3], ['ミサキ', 'NIGHT KITE', 5], ['ケンジ', 'RED SUNSET', 7], ['ユウ', 'BLUE FLAME', 1]];

UI.register({
  id: 'race',
  build(n) {
    n.innerHTML = `
      <div class="rh">
        <div class="rh-band"></div><div class="rh-player"></div>
        <div class="rh-time"></div><div class="rh-rivals"></div>
        <div class="rh-sign"></div><div class="rh-slope"></div><div class="rh-secpop"></div>
        <div class="rh-tags"></div><div class="rh-onos"></div>
        <div class="rh-mm"><div class="rem"></div><canvas></canvas><div class="cn"></div></div>
        <div class="rh-gearbox"><div class="rh-gear"></div><div class="rh-cond"></div></div>
        <div class="rh-meter"><canvas></canvas></div>
        <div class="rh-in"><div class="th"><i></i><span>A</span></div><div class="br"><i></i><span>B</span></div><div class="sw"><i></i></div></div>
        <div class="rh-toggles"><div class="rh-tg rh-tg-ghost"><span class="k">G</span>ゴースト<b>ON</b></div><div class="rh-tg rh-tg-line"><span class="k">L</span>ラインガイド<b>OFF</b></div></div>
        <div class="rh-warn">WRONG WAY — R でコース復帰</div>
      </div>
      <div class="hud-msg"></div>
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
    if (params.mode === 'battle' && !params.online) {
      // rival: a different car with tuning scaled by CPU level
      const pool = CARS.filter(c => c.id !== gc.carId);
      const rc = pool[Math.floor(Math.random() * pool.length)];
      const lvl = params.cpu || { skill: 0.9, aggr: 0.45 };
      const t = Math.round((lvl.skill - 0.8) * 15);
      const nm = RIVAL_NAMES[Math.floor(Math.random() * RIVAL_NAMES.length)];
      rivals.push({ spec: buildSpec(rc, { engine: t, tires: t, weight: t, suspension: t }), dress: { paint: ['red', 'black', 'blue', 'silver'][Math.floor(Math.random() * 4)], wheel: 'gold6', spoiler: 'mid', aero: 'street', decal: 'number', number: '99' }, skill: lvl.skill, aggr: lvl.aggr, name: nm[0], team: nm[1], carName: rc.name, rp: Math.round(Save.profile.rp * 0.8 + lvl.skill * 600 - 400), icon: nm[2] });
    }
    const net = params.online || null;
    if (net && net.peer) {
      const o = net.peer; const base = carById(o.carId);
      rivals.push({ ctrl: 'net', net, spec: buildSpec(base, o.tune || {}, o.setup || {}, o.dress), dress: o.dress, name: o.name, team: o.team, carName: o.carName || base.name, rp: o.rp || 0, icon: o.icon || 0, lane: net.role === 'host' ? 1.9 : -1.9 });
    }
    const hud = { root: $('.rh', this.el), msg: $('.hud-msg', this.el) };

    const start = async () => {
      const ghost = params.mode === 'trial' ? await Save.loadGhost(params.courseId, params.dir) : null;
      this.race = new Race(App.gfx, {
        mode: params.mode, courseId: params.courseId, dir: params.dir, weather: params.weather, time: params.time,
        player: { spec, dress: gc.dress, name: Save.profile.driverName, lane: net ? (net.role === 'host' ? -1.9 : 1.9) : undefined }, rivals, net, ghost, best: rec, hud,
        playerInfo: { name: Save.profile.driverName, team: Save.profile.teamName, rp: Save.profile.rp, icon: Save.profile.icon, carName: gc.name },
        settings: App.settings, meter: gc.meter, onFinish: (res) => this.finish(res),
        onSetting: (k, v) => { App.settings[k] = v; Save.touch('settings'); },
      });
      App.race = this.race;
      const race = this.race; App.gfx.setView({ scene: race.scene, camera: race.camera, update: (dt) => { if (this.race === race) race.update(dt); } });
      if (net) {
        this.race.msg('READY', 'small');
        net.on('closed', () => { if (this.race === race && race.state !== 'finish' && net.remoteFinish == null) { race.msg('相手が退出しました', 'small'); toast('対戦相手が退出しました — このまま走り切ると勝利です'); } });
        net.scheduleStart(() => { if (this.race === race) race.start(); }); net.send('ready');
      } else this.race.start();
    };
    Audio.stopMusic(0.3);
    const touchOn = App.settings.touch === 'on' || (App.settings.touch === 'auto' && App.isTouch);
    $('.touch', this.el).classList.toggle('on', touchOn);
    $('.rh', this.el).classList.toggle('touchmode', touchOn);
    $('.pause-menu', this.el).classList.remove('on');
    const btns = $$('.pause-menu .btn', this.el);
    this.pf = new Focus(btns, { axis: 'v', onSelect: (i) => this.pauseAct(i) });
    this.cleanup();
    return start();
  },
  cleanup() { if (this.race) { this.race.dispose(); this.race = null; App.race = null; } },
  leave() { this.cleanup(); Object.keys(Input.touch).forEach(k => Input.touch[k] = 0); },
  async quitOnline() {
    if (this._q) return; this._q = true;
    const ok = await dialog.confirm('対戦を終了', 'オンライン対戦を終了しますか?<br>(途中で抜けると敗北になります)', '終了する', '続ける');
    this._q = false; if (!ok) return;
    await this.params.online.leave(); this.cleanup(); Audio.stopEngines(); UI.go('online');
  },
  togglePause() {
    if (this.params?.online) return this.quitOnline();
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
    let credits = 0, rp = 0, tp = 0, newRecord = false;
    const km = Math.max(0, res.distance) / 1000;
    p.stats.races++; p.stats.km += km; gc.races = (gc.races || 0) + 1; gc.km = (gc.km || 0) + km;
    if (res.time != null && (res.mode === 'trial')) {
      p.stats.trials++;
      credits += 300 + Math.round(km * 60); rp += 40; tp += 5;
      if (!prev || res.time < prev.best) {
        newRecord = true; credits += prev ? 500 : 200; rp += prev ? 60 : 20; tp += 5;
        p.records[key] = { best: res.time, sections: res.sections, carId: gc.carId, car: gc.name, date: Date.now() };
        await Save.saveGhost(res.courseId, res.dir, res.ghost);
      }
    }
    if (res.mode === 'battle') {
      p.stats.battles = (p.stats.battles || 0) + 1;
      if (this.params.online) { p.stats.online = (p.stats.online || 0) + 1; if (res.won) p.stats.onlineWins = (p.stats.onlineWins || 0) + 1; }
      const lvl = this.params.online ? { reward: 1200 } : this.params.cpu || { reward: 700 };
      if (res.won) { p.stats.wins++; credits += lvl.reward; rp += 120; tp += 10; } else { credits += Math.round(lvl.reward * 0.25); rp += 25; tp += 3; }
      if (res.time != null && (!prev || res.time < prev.best)) { newRecord = true; p.records[key] = { best: res.time, sections: res.sections, carId: gc.carId, car: gc.name, date: Date.now() }; }
    }
    let event = null;
    if (this.params.event && res.time != null) {
      const e = this.params.event; p.flags.events ||= {};
      const st = p.flags.events[e.id] ||= { best: null, cleared: false };
      if (st.best == null || res.time < st.best) st.best = res.time;
      if (res.time <= e.target && !st.cleared) { st.cleared = true; credits += e.reward; rp += 150; tp += 15; event = { cleared: true, reward: e.reward }; }
      else event = { cleared: res.time <= e.target, reward: 0 };
    }
    const rankBefore = rankOf(p.rp);
    p.credits += credits; p.rp += rp; p.xp += rp; p.tp = (p.tp ?? 0) + tp;
    // unlocks
    const unlocked = [];
    for (const c of COURSES) if (c.unlock && !p.unlocked.courses.includes(c.id) && p.rp >= c.unlock.rp) { p.unlocked.courses.push(c.id); unlocked.push(c.jp); }
    await Save.persistNow('race-end');
    if (this.params.online) this.params.online.leave();
    res.cars = this.race ? this.race.cars.length : 2;
    if (this.race) { res.targets = this.race.ui ? this.race.ui.targets : targetTimes(this.race); res.weather = this.params.weather; res.tod = this.params.time; const rv = this.race.cars.find(c => c !== this.race.player); if (rv) { res.rivalName = rv.name; res.rivalCar = rv.carName; } }
    UI.go('result', { res, prev, newRecord, ghostSaved: newRecord && res.mode === 'trial', credits, rp, tp, rankBefore, rankAfter: rankOf(p.rp), unlocked, event, params: this.params });
  },
  onAction(a) {
    if (!this.race) return;
    if (a === 'back') return this.togglePause();
    if (this.race.paused) this.pf.action(a);
  },
});

UI.register({
  id: 'result',
  build(n) {
    n.innerHTML = `<div class="rs-sky"></div><div class="pp"></div>
      <div class="bigtimer rs-tm"><b>20</b></div>
      <div class="rs-info"></div><div class="rs-center"></div><div class="rs-right"></div><div class="rs-medals"></div><div class="rs-rew"></div>
      <div class="rs-btns"></div><div class="cbx"></div>${logoMark()}${keyGuide([['lr', '選択'], ['ok', '決定']])}`;
  },
  enter(d) {
    const { res, prev, newRecord } = d; const c = courseById(res.courseId); const p = Save.profile; const gc = Save.activeCar;
    Audio.playMusic('result'); Audio.stopEngines();
    // scenic backdrop: the course itself, slowly flown over
    import('../game/gfx.js').then(({ CoursePreview }) => { if (UI.current !== this) return; App.coursePreview ||= new CoursePreview(App.gfx); App.coursePreview.show(res.courseId, res.dir, res.weather || c.weather, res.tod || c.time); App.gfx.setView(App.coursePreview); });
    App.gfx.setView(null);
    $('.pp', this.el).innerHTML = plate(); $('.cbx', this.el).innerHTML = consoleBox();
    const battle = res.mode === 'battle';
    $('.rs-info', this.el).innerHTML = `<div class="hd">レース情報</div><div class="v">${c.jp} / ${c.dirs[res.dir][1]} / ${(res.tod || c.time) === 'night' ? '夜' : (res.tod || c.time) === 'dusk' ? '夕方' : '昼'}${res.weather === 'rain' ? ' / 雨' : ''}</div>
      <div class="car">${esc(gc.name)} <span>${gc.drive}</span> <span>${tuneLevel(gc)}</span></div>`;
    // right: goal & section times
    const secs = res.sections.map((t, i) => { const split = t - (i ? res.sections[i - 1] : 0); const b = prev?.sections; const bs = b && b[i] != null ? b[i] - (i ? b[i - 1] : 0) : null; return `<div class="sr"><i>${i + 1}</i><b>${fmt(split)}</b><em class="${bs == null ? '' : split <= bs ? 'fast' : 'slow'}">${bs == null ? '(-\'--"---)' : '(' + fmtDelta(split - bs) + ')'}</em></div>`; }).join('');
    $('.rs-right', this.el).innerHTML = `<div class="hd">ゴールタイム</div><div class="gt">${fmt(res.time)}</div><div class="gd ${prev && res.time != null ? (res.time < prev.best ? 'fast' : 'slow') : ''}">${prev && res.time != null ? '(' + fmtDelta(res.time - prev.best) + ')' : '(-\'--"---)'}</div>
      <div class="hd" style="margin-top:22px">セクションタイム</div>${secs}`;
    // centre: evaluation tier (time attack) or WIN/LOSE (battle)
    const T = (res.targets || []).slice().reverse(); // ROOKIE → LEGEND
    let html;
    if (!battle) {
      const got = res.time != null ? T.filter(t => res.time <= t.time) : [];
      const tier = got.length ? got[got.length - 1] : null; const next = T[got.length] || null;
      const prevTier = prev ? T.filter(t => prev.best <= t.time).length : 0;
      html = `<div class="sub">${newRecord ? 'Your Record updated!' : 'Time Attack Result'}</div><div class="title ${newRecord ? 'gold' : ''}">${newRecord ? '自己ベスト更新' : (res.time != null ? 'GOAL' : 'RETIRE')}</div>
        <div class="tier"><small>TIME ATTACK</small><b>${tier ? tier.name : 'NO RANK'}</b>${got.length > prevTier ? '<i class="new">New</i>' : ''}</div>
        <div class="track">${T.map((t, i) => `<span class="${i < got.length ? 'on' : ''}">${t.name}</span>${i < T.length - 1 ? '<em>▶</em>' : ''}`).join('')}</div>
        <div class="tg"><span>目標タイム</span><b>${tier ? fmt(tier.time) : (T[0] ? fmt(T[0].time) : '-')}</b><i>${tier ? 'クリア!' : '未達成'}</i></div>
        <div class="tg"><span>次の評価タイム</span><b>${next ? fmt(next.time) : '— 最高評価 —'}</b></div>`;
    } else {
      html = `<div class="sub">Course Battle Result</div><div class="title ${res.won ? 'gold' : 'lose'}">${res.won ? 'WIN!!' : 'LOSE'}</div>
        <div class="vs"><div class="me"><b>${esc(p.driverName)}</b><small>${esc(gc.name)}</small></div><em>VS</em><div class="op"><b>${esc(res.rivalName || 'RIVAL')}</b><small>${esc(res.rivalCar || '')}</small></div></div>
        <div class="tg"><span>最終順位</span><b>${res.position} / ${res.cars || 2}</b></div>
        <div class="tg"><span>FINAL ADVANTAGE</span><b class="${(res.advantage ?? 0) >= 0 ? 'fast' : 'slow'}">${res.advantage != null ? (res.advantage >= 0 ? '+' : '') + res.advantage.toFixed(1) + 'm' : '—'}</b></div>`;
    }
    $('.rs-center', this.el).innerHTML = html;
    $('.rs-rew', this.el).innerHTML = `<span>CREDITS <b>+¥${d.credits.toLocaleString()}</b></span><span>RP <b>+${d.rp}</b></span><span>TUNE POINT <b>+${d.tp}</b></span><span>RANK <b>${d.rankBefore.label} → ${d.rankAfter.label}</b></span>${d.unlocked.length ? `<span>UNLOCK <b>${d.unlocked.join(', ')}</b></span>` : ''}${d.ghostSaved ? '<span><b>GHOST SAVED</b></span>' : ''}`;
    // rankings (time attack only)
    const medals = $('.rs-medals', this.el);
    if (!battle && res.time != null) {
      medals.innerHTML = [['店内ランキング', 'local', '🏁'], ['車種別ランキング', 'car', '🚗'], ['総合ランキング', 'world', '🌐']].map(([l, k, ic]) => `<div class="md" data-k="${k}"><i>${ic}</i><div><small>${l}</small><b>…</b></div></div>`).join('');
      this.rankings(res, gc);
    } else medals.innerHTML = '';
    // buttons
    const btns = d.params.online ? [['オンライン対戦へ', 'online'], ['START MENU', 'start'], ['MODE SELECT', 'mode']] : d.params.event ? [['RETRY', 'retry'], ['EVENT LIST', 'special'], ['MODE SELECT', 'mode']] : [['次へ(コース選択)', 'course'], ['RETRY', 'retry'], ['GARAGE', 'garage'], ['MODE SELECT', 'mode']];
    $('.rs-btns', this.el).innerHTML = btns.map(([l, a], i) => `<div class="mtile ${i ? 'k' : 'y'}" data-a="${a}" style="width:250px;height:84px;font-size:24px">${l}</div>`).join('');
    const tiles = $$('.rs-btns .mtile', this.el);
    this.focus = new Focus(tiles, { axis: 'h', onSelect: (i, b) => { stopTimer(); Audio.ui('ok'); const a = b.dataset.a; if (a === 'retry') UI.go('race', d.params); else UI.go(a); } });
    const ap = this.focus.apply.bind(this.focus); this.focus.apply = () => { ap(); tiles.forEach((t, k) => t.classList.toggle('sel', k === this.focus.i)); }; this.focus.apply();
    // staged reveal with matching SE
    this.el.classList.remove('reveal'); void this.el.offsetWidth; this.el.classList.add('reveal');
    [300, 900, 1500, 2100].forEach((t, i) => setTimeout(() => { if (UI.current === this) Audio.ui(i === 1 && newRecord ? 'coin' : i === 3 ? 'start' : 'section'); }, t));
    if (d.rankAfter.label !== d.rankBefore.label) setTimeout(() => toast(`RANK UP!! ${d.rankAfter.label}`), 2500);
    startTimer($('.rs-tm', this.el), 20, () => this.focus.select());
  },
  leave() { stopTimer(); },
  async rankings(res, gc) {
    const key = `${res.courseId}:${res.dir}`;
    const set = (k, txt) => { const n = this.el.querySelector(`.md[data-k="${k}"] b`); if (n) n.textContent = txt; };
    try {
      const all = (await idb.all('profiles')).map(r => r.data).filter(pp => pp.records && pp.records[key]);
      const times = all.map(pp => pp.records[key].best).sort((a, b) => a - b);
      set('local', `${times.filter(t => t < res.time - 1e-6).length + 1}位 / ${Math.max(1, times.length)}`);
      const cars = all.filter(pp => pp.records[key].carId === gc.carId).map(pp => pp.records[key].best);
      set('car', `${cars.filter(t => t < res.time - 1e-6).length + 1}位`);
    } catch (e) { set('local', '—'); set('car', '—'); }
    if (Save.mode !== 'account' || !Net.isConfigured()) { set('world', '要ログイン'); return; }
    try {
      const board = `${res.courseId}_${res.dir}`; const best = Save.profile.records[key]?.best ?? res.time;
      await Net.submitScore(board, { time: best, name: Save.profile.driverName, team: Save.profile.teamName, carId: gc.carId, carName: gc.name });
      set('world', `${await Net.rankOf(board, best)}位`);
      set('car', `${await Net.rankOf(board, best, gc.carId)}位`);
    } catch (e) { console.warn(e); set('world', '通信エラー'); }
  },
  onAction(a) { if (a === 'back') return; this.focus.action(a); },
});
