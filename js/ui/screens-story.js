// STORY MODE screens: story select (spheres) → episode intro (dialogue) → battle → story result
import { UI, $, $$, esc, dialog, toast, startTimer, stopTimer, avatarSVG, rankBadge } from './core.js';
import { kgIcon, logoMark } from './frame.js';
import { carThumb } from './screens-menu.js';
import { App } from '../app.js';
import { Audio } from '../audio/audio.js';
import { Save, rankOf } from '../core/save.js';
import { carById } from '../data/cars.js';
import { courseById } from '../data/courses.js';
import { SEASONS, findEpisode, storyRank } from '../data/story.js';
import { CoursePreview } from '../game/gfx.js';

// ---- original character portrait generator (anime-style bust, vector) ----
export function portraitSVG(p = {}, size = 160, uid = 'x') {
  const hc = p.hc || '#222', sk = p.skin || '#f0c8a0', ey = p.eye || '#222', id = 'pt' + uid;
  const hair = {
    spiky: `<path d="M22 64 L14 40 L30 46 L28 22 L46 36 L52 10 L64 32 L78 12 L82 36 L100 22 L96 46 L112 40 L102 66 C100 44 84 34 62 34 C40 34 26 44 22 64Z" fill="${hc}"/>`,
    slick: `<path d="M24 62 C22 34 40 20 64 20 C90 20 106 34 104 60 C96 42 82 36 60 38 C44 39 32 46 24 62Z" fill="${hc}"/><path d="M40 30 C60 22 84 26 98 40" stroke="rgba(255,255,255,.35)" stroke-width="3" fill="none"/>`,
    long: `<path d="M20 120 C14 70 22 24 64 22 C106 24 114 70 108 120 L96 120 C100 80 96 50 86 44 C76 52 50 54 38 44 C30 54 26 84 32 120Z" fill="${hc}"/>`,
    buzz: `<path d="M26 58 C26 34 42 24 64 24 C86 24 102 34 102 58 C94 46 80 40 64 40 C48 40 34 46 26 58Z" fill="${hc}"/>`,
    bob: `<path d="M18 92 C12 50 30 22 64 22 C98 22 116 50 110 92 L98 92 C98 64 92 50 84 44 C70 54 50 54 42 44 C34 52 30 66 30 92Z" fill="${hc}"/>`,
    messy: `<path d="M20 66 C16 40 34 18 64 20 C96 18 112 40 108 66 L100 52 L92 60 L86 44 L74 52 L66 40 L56 52 L46 42 L38 56 L30 48Z" fill="${hc}"/>`,
    swept: `<path d="M22 70 C18 38 40 18 70 20 C96 22 110 40 106 64 C96 50 86 44 70 44 L40 70 L44 48 C34 52 28 60 22 70Z" fill="${hc}"/>`,
    short: `<path d="M24 60 C22 34 40 22 64 22 C88 22 106 34 104 60 L98 50 C88 40 40 40 30 50Z" fill="${hc}"/>`,
    pony: `<path d="M22 64 C20 36 38 22 64 22 C90 22 108 36 106 64 C98 46 84 40 64 40 C44 40 30 46 22 64Z" fill="${hc}"/><path d="M100 40 C122 50 120 90 108 110 C112 84 108 60 98 50Z" fill="${hc}"/>`,
    hood: `<path d="M10 128 C8 60 26 16 64 14 C102 16 120 60 118 128 L100 128 C104 80 96 50 64 46 C32 50 24 80 28 128Z" fill="${hc}"/>`,
  }[p.hair || 'short'];
  const acc = {
    shades: '<path d="M38 66 H58 L56 76 H40Z M70 66 H90 L88 76 H72Z" fill="#111"/><path d="M58 68 H70" stroke="#111" stroke-width="3"/>',
    glasses: '<rect x="38" y="64" width="20" height="13" rx="3" fill="none" stroke="#222" stroke-width="2.5"/><rect x="70" y="64" width="20" height="13" rx="3" fill="none" stroke="#222" stroke-width="2.5"/><path d="M58 70 H70" stroke="#222" stroke-width="2"/>',
    earring: '<circle cx="30" cy="84" r="3" fill="#ffd400"/>',
    scar: '<path d="M80 54 L90 76" stroke="#a0504a" stroke-width="2.5"/>',
    cap: `<path d="M22 50 C24 28 44 18 64 18 C86 18 104 28 106 50 Z" fill="#c01020"/><path d="M60 48 H120 L112 56 H58Z" fill="#900a10"/>`,
    mask: '<path d="M36 80 C50 92 78 92 92 80 L92 100 C78 108 50 108 36 100Z" fill="#111"/>',
  }[p.acc] || '';
  const eyes = p.acc === 'shades' ? '' : `<path d="M40 68 C44 63 54 63 58 68 L56 74 C52 76 46 76 42 74Z" fill="#fff"/><path d="M70 68 C74 63 84 63 88 68 L86 74 C82 76 76 76 72 74Z" fill="#fff"/><circle cx="50" cy="70" r="4" fill="${ey}"/><circle cx="80" cy="70" r="4" fill="${ey}"/><circle cx="51.5" cy="68.5" r="1.3" fill="#fff"/><circle cx="81.5" cy="68.5" r="1.3" fill="#fff"/><path d="M38 61 L58 59 M70 59 L90 61" stroke="${hc}" stroke-width="3.5" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 128 128" width="${size}" height="${size}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef2f6"/><stop offset="1" stop-color="#9aa6b4"/></linearGradient></defs>
    <rect width="128" height="128" fill="url(#${id})"/>
    <path d="M14 128 C16 104 38 96 64 96 C90 96 112 104 114 128Z" fill="#2a3040"/><path d="M50 96 L64 112 L78 96" fill="#fff"/>
    <path d="M52 86 H76 V102 C70 108 58 108 52 102Z" fill="${sk}" filter="brightness(.92)"/>
    <path d="M30 60 C30 36 44 30 64 30 C84 30 98 36 98 60 C98 84 84 98 64 98 C44 98 30 84 30 60Z" fill="${sk}"/>
    <path d="M28 64 C24 64 24 76 30 78 M100 64 C104 64 104 76 98 78" fill="${sk}" stroke="${sk}" stroke-width="4"/>
    ${eyes}<path d="M62 74 L60 84 L65 84" stroke="rgba(0,0,0,.25)" stroke-width="2" fill="none"/><path d="M56 90 C62 92 68 92 72 90" stroke="#8a4a3a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    ${hair}${acc}<rect width="128" height="128" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="2"/></svg>`;
}

const prog = () => { const p = Save.profile; p.story ||= { cleared: {}, pts: 0, plays: 0 }; return p.story; };
const arcCleared = (arc) => arc.episodes.every(e => prog().cleared[e.id]);
const arcUnlocked = (season, k) => k === 0 || arcCleared(season.arcs[k - 1]);
const epUnlocked = (arc, j) => j === 0 || !!prog().cleared[arc.episodes[j - 1].id];
const COLORS = { blue: ['#9ad4ff', '#1a6ad0', '#0a2a6a'], green: ['#a6f0a0', '#2a9a3a', '#0a3a10'], orange: ['#ffd29a', '#e07a10', '#5a2a00'], red: ['#ffb0a0', '#d02a1a', '#5a0a06'] };
const LV_COL = { '初級': '#1a5ad0', '中級': '#2a9a3a', '上級': '#d07a10', '超上級': '#d02a1a' };
const lock = '<svg viewBox="0 0 40 40" width="46" height="46"><rect x="4" y="16" width="32" height="22" rx="4" fill="#222" stroke="#aaa" stroke-width="2"/><path d="M11 16 V11 C11 3 29 3 29 11 V16" fill="none" stroke="#aaa" stroke-width="4"/><circle cx="20" cy="27" r="3.5" fill="#aaa"/></svg>';

// ───────── STORY SELECT ─────────
UI.register({
  id: 'story',
  build(n) {
    n.innerHTML = `<div class="st-bg"></div>
      <div class="st-head"><b>ストーリーを選んでください</b><span class="st-season"></span></div>
      <div class="st-time"><small>TIME</small><b>30</b></div>
      <div class="st-arcs"></div><div class="st-info"></div><div class="st-ports"></div>
      <div class="st-bar"><span>${kgIcon('lr')}選択</span><i></i><span>${kgIcon('ud')}ストーリー / 話</span><i></i><span>${kgIcon('ok')}決定</span><i></i><span data-act="back">${kgIcon('back')}戻る</span></div>`;
  },
  enter(params = {}) {
    App.gfx.setView(null);
    this.season = SEASONS[0]; this.zone = 'arc';
    const firstOpen = this.season.arcs.findIndex((a, k) => arcUnlocked(this.season, k) && !arcCleared(a));
    this.ai = params.arc ?? (firstOpen < 0 ? 0 : firstOpen); this.ei = 0;
    $('.st-season', this.el).textContent = `${this.season.title} 「${this.season.jp}」 · ストーリーランク ${storyRank(prog().pts).rank}`;
    this.render();
    Audio.playMusic('menu');
    const tm = $('.st-time', this.el);
    if (App.settings.custTimer) startTimer(tm, 30, () => this.pick()); else tm.querySelector('b').textContent = '∞';
  },
  leave() { stopTimer(); },
  render() {
    const S = this.season;
    $('.st-arcs', this.el).innerHTML = S.arcs.map((a, k) => {
      const c = COLORS[a.color], open = arcUnlocked(S, k), done = arcCleared(a), sel = k === this.ai;
      return `<div class="sph ${sel ? 'sel' : ''} ${open ? '' : 'lk'}" data-k="${k}"><div class="lv" style="background:${LV_COL[a.level]}">${a.level}</div>
        <div class="ball" style="background:radial-gradient(circle at 38% 30%, ${c[0]} 0%, ${c[1]} 45%, ${c[2]} 100%)"><div class="t">${esc(a.title)}</div><div class="s">${a.sub}</div>${done ? '<div class="cl">CLEARED</div>' : ''}</div>
        ${open ? '' : `<div class="lock">${lock}</div>`}${sel && k < S.arcs.length - 1 ? '<i class="chev">≫</i>' : ''}</div>`;
    }).join('');
    $$('.st-arcs .sph', this.el).forEach(s => s.onclick = () => { const k = +s.dataset.k; if (k === this.ai && this.zone === 'arc') return this.pick(); this.ai = k; this.zone = 'arc'; this.ei = 0; Audio.ui('move'); this.render(); });
    const arc = S.arcs[this.ai];
    $('.st-ports', this.el).innerHTML = arc.episodes.map((e, j) => {
      const seen = prog().cleared[e.id] || (arcUnlocked(S, this.ai) && epUnlocked(arc, j));
      return `<div class="pc ${prog().cleared[e.id] ? 'done' : ''} ${this.zone === 'ep' && j === this.ei ? 'sel' : ''} ${seen ? '' : 'q'}" data-j="${j}">${seen ? portraitSVG(e.rival.p, 150, e.id) + `<span class="nm">${esc(e.rival.name)}</span>${prog().cleared[e.id] ? '<span class="ok">CLEAR</span>' : ''}` : '<b>?</b>'}</div>`;
    }).join('') + `<div class="pc q">${arcCleared(arc) ? '<b style="font-size:30px">NEXT</b>' : '<b>?</b>'}</div>`;
    $$('.st-ports .pc[data-j]', this.el).forEach(p => p.onclick = () => { const j = +p.dataset.j; if (this.zone === 'ep' && j === this.ei) return this.pick(); this.zone = 'ep'; this.ei = j; Audio.ui('move'); this.render(); });
    const next = this.zone === 'ep' ? this.ei : Math.max(0, arc.episodes.findIndex(e => !prog().cleared[e.id]));
    const e = arc.episodes[next], course = courseById(arc.courseId);
    $('.st-info', this.el).innerHTML = arcUnlocked(S, this.ai)
      ? `<b>${esc(arc.title)}${arc.sub}</b> — ${esc(arc.story)}<br><span>第${next + 1}話「${esc(e.title)}」 VS ${esc(e.rival.name)}(${esc(carById(e.rival.carId).name)}) · ${course.jp} ${course.dirs[arc.dir][1]}${arc.weather === 'rain' ? ' · 雨' : ''} · クリア報酬 <em>${e.tp} TP</em></span>`
      : `<b>${esc(arc.title)}${arc.sub}</b> — 前のストーリーをすべてクリアすると解放されます。`;
  },
  pick() {
    const S = this.season, arc = S.arcs[this.ai];
    if (!arcUnlocked(S, this.ai)) { Audio.ui('error'); return toast('前のストーリーをクリアすると解放されます'); }
    let j = this.zone === 'ep' ? this.ei : arc.episodes.findIndex(e => !prog().cleared[e.id]);
    if (j < 0) j = arc.episodes.length - 1; // all cleared → replay the boss
    if (!epUnlocked(arc, j)) { Audio.ui('error'); return toast('前の話をクリアしてください'); }
    stopTimer(); Audio.ui('start');
    UI.go('storyintro', { epId: arc.episodes[j].id });
  },
  onAction(a) {
    const S = this.season, n = S.arcs.length, arc = S.arcs[this.ai];
    if (a === 'back') { Audio.ui('back'); return UI.go('mode'); }
    if (a === 'down' && this.zone === 'arc') { this.zone = 'ep'; this.ei = Math.max(0, arc.episodes.findIndex(e => !prog().cleared[e.id])); Audio.ui('move'); return this.render(); }
    if (a === 'up' && this.zone === 'ep') { this.zone = 'arc'; Audio.ui('move'); return this.render(); }
    if (a === 'left' || a === 'right') {
      const d = a === 'left' ? -1 : 1;
      if (this.zone === 'arc') this.ai = (this.ai + d + n) % n; else this.ei = Math.max(0, Math.min(arc.episodes.length - 1, this.ei + d));
      Audio.ui('move'); return this.render();
    }
    if (a === 'ok') return this.pick();
  },
});

// ───────── EPISODE INTRO (dialogue) ─────────
UI.register({
  id: 'storyintro',
  build(n) {
    n.innerHTML = `<div class="si-dim"></div><div class="si-top"></div>
      <div class="si-me"></div><div class="si-rv"></div>
      <div class="si-box"><div class="who"></div><div class="txt"></div><div class="nx">▼</div></div>
      <div class="si-vs"></div>
      <div class="st-bar" style="bottom:30px"><span>${kgIcon('ok')}次へ</span><i></i><span data-act="back">${kgIcon('back')}スキップ</span></div>`;
  },
  enter(params) {
    const f = findEpisode(params.epId); this.f = f; this.li = -1; this.done = false;
    const { arc, ep } = f, p = Save.profile, course = courseById(arc.courseId);
    App.coursePreview ||= new CoursePreview(App.gfx); App.coursePreview.show(arc.courseId, arc.dir, arc.weather, arc.time); App.gfx.setView(App.coursePreview);
    const chap = f.season.arcs.indexOf(arc) + 1, epn = arc.episodes.indexOf(ep) + 1;
    $('.si-top', this.el).innerHTML = `<span>Chapter ${chap} 第${epn}話</span><b>「${esc(ep.title)}」</b><em>${course.jp} ${course.dirs[arc.dir][1]}</em>`;
    $('.si-me', this.el).innerHTML = `<div class="frame">${avatarSVG(p.icon || 0, 300)}</div><div class="nm">${esc(p.driverName)}<small>${esc(p.teamName || '')}</small></div>`;
    $('.si-rv', this.el).innerHTML = `<div class="frame">${portraitSVG(ep.rival.p, 300, 'big' + ep.id)}</div><div class="nm">${esc(ep.rival.name)}<small>${esc(ep.rival.team)}</small></div>`;
    $('.si-vs', this.el).classList.remove('on');
    Audio.playMusic('title');
    this.next();
  },
  next() {
    const lines = this.f.ep.intro;
    this.li++;
    if (this.li >= lines.length) return this.vs();
    const [who, text] = lines[this.li];
    this.el.classList.toggle('me-talk', who === 'me'); this.el.classList.toggle('rv-talk', who !== 'me');
    $('.si-box .who', this.el).textContent = who === 'me' ? Save.profile.driverName : this.f.ep.rival.name;
    const t = $('.si-box .txt', this.el); t.textContent = ''; let i = 0; clearInterval(this.ty);
    this.ty = setInterval(() => { t.textContent = text.slice(0, ++i); if (i % 2) Audio.blip(880, 0.012, 'square', 0.02); if (i >= text.length) clearInterval(this.ty); }, 28);
    Audio.ui('move');
  },
  vs() {
    if (this.done) return; this.done = true; clearInterval(this.ty);
    const { ep } = this.f; const rc = carById(ep.rival.carId), gc = Save.activeCar;
    const v = $('.si-vs', this.el);
    v.innerHTML = `<div class="l"><img src="${carThumb(gc.carId, gc.dress)}"><b>${esc(gc.name)}</b></div><div class="m">VS</div><div class="r"><img src="${carThumb(rc.id, { color: { hex: ['#c8141c', '#121316', '#1a4fbf', '#f2c40c', '#a9adb3'][ep.id.length % 5], finish: 'metallic' } })}"><b>${esc(rc.name)}</b></div>`;
    v.classList.add('on'); Audio.ui('start');
    setTimeout(() => { if (UI.current === this) this.race(); }, 2200);
  },
  race() {
    const { arc, ep } = this.f; const r = ep.rival; const t = r.tune || 0;
    UI.go('race', { mode: 'battle', story: { epId: ep.id }, courseId: arc.courseId, dir: arc.dir, weather: arc.weather, time: arc.time,
      cpu: { skill: r.skill, aggr: r.aggr, reward: ep.credits },
      rival: { carId: r.carId, name: r.name, team: r.team, tune: { engine: Math.min(3, Math.round(t / 3)), tires: Math.min(3, Math.round(t / 3)), weight: Math.min(3, Math.round(t / 4)), suspension: Math.min(3, Math.round(t / 3)) }, color: ['#c8141c', '#121316', '#1a4fbf', '#f2c40c', '#a9adb3'][ep.id.length % 5] } });
  },
  leave() { clearInterval(this.ty); },
  onAction(a) {
    if (a === 'back') { Audio.ui('ok'); return this.done ? this.race() : this.vs(); }
    if (a === 'ok') { const t = $('.si-box .txt', this.el), full = this.f.ep.intro[this.li]?.[1]; if (full && t.textContent.length < full.length) { clearInterval(this.ty); t.textContent = full; return; } return this.done ? this.race() : this.next(); }
  },
});

// ───────── STORY RESULT ─────────
// called by the race screen: applies progress & rewards, then shows the result
export function storyFinish(res, epId) {
  const f = findEpisode(epId), st = prog(), p = Save.profile;
  const first = res.won && !st.cleared[epId];
  const before = storyRank(st.pts).rank;
  let tp = 0, pts = 0;
  st.plays++;
  if (res.won) { tp = first ? f.ep.tp : 1; pts = first ? (f.ep.boss ? 200 : 100) : 0; st.cleared[epId] = true; }
  st.pts += pts; p.tp = (p.tp ?? 0) + tp;
  return { f, won: res.won, first, tp, pts, rankBefore: before, rankAfter: storyRank(st.pts).rank, time: res.time };
}
UI.register({
  id: 'storyresult',
  build(n) {
    n.innerHTML = `<div class="sr-bg"></div><div class="pp"></div><div class="sr-tm bigtimer"><b>15</b></div>
      <div class="sr-gt"></div><div class="sr-head"></div><div class="sr-panels"></div><div class="sr-btns"></div>${logoMark()}`;
  },
  enter(d) {
    this.d = d; const { f, won, tp, pts, rankBefore, rankAfter, first } = d; const st = prog(); const p = Save.profile;
    App.gfx.setView(null);
    $('.pp', this.el).innerHTML = `<div class="af-plate"><div class="av">${avatarSVG(p.icon, 128)}</div><div class="nm"><div class="team">${esc(p.teamName || '')}</div><div class="drv">${esc(p.driverName)}</div></div><div class="rk">${rankBadge(p.rp, 100)}</div></div>`;
    const chap = f.season.arcs.indexOf(f.arc) + 1, epn = f.arc.episodes.indexOf(f.ep) + 1;
    $('.sr-gt', this.el).innerHTML = `<small>ゴールタイム</small><b>${d.time != null ? fmtT(d.time) : '--\'--"---'}</b>`;
    $('.sr-head', this.el).innerHTML = `<div class="ch">Chapter ${chap} 第${epn}話「${esc(f.ep.title)}」</div><div class="big ${won ? '' : 'lose'}">${won ? 'CLEARED!!' : 'FAILED…'}</div>
      <div class="msg">${won ? (rankAfter > rankBefore ? 'ストーリーランク昇格!!' : first ? 'ストーリー進行!' : 'リプレイクリア') : 'もう一度挑戦しよう'}</div><div class="line">${esc(won ? f.ep.win : f.ep.lose)} — ${esc(f.ep.rival.name)}</div>`;
    const sr = storyRank(st.pts);
    const badge = (lab) => `<div class="medal"><svg viewBox="0 0 120 120" width="170" height="170"><circle cx="60" cy="60" r="56" fill="#7a3a2a"/><circle cx="60" cy="60" r="50" fill="#d8a070"/><circle cx="60" cy="60" r="44" fill="radial-gradient(#3dd17a,#0a6a2a)"/><circle cx="60" cy="60" r="44" fill="#1aa04a"/><path d="M36 74 C52 70 70 52 84 30 C74 60 60 74 40 80Z" fill="#0a4a1a"/><text x="60" y="68" text-anchor="middle" font-family="Arial Black" font-style="italic" font-size="22" fill="#fff" stroke="#063" stroke-width="1">${lab}</text></svg></div>`;
    $('.sr-panels', this.el).innerHTML = `
      <div class="pn"><div class="hd">ストーリーランク</div>${badge('STORY')}<div class="stars">${'★'.repeat(Math.min(5, sr.rank))}</div><div class="bar"><span>次回昇格まで</span><b>${sr.next}</b><em>+${pts}</em></div></div>
      <div class="pn"><div class="hd">チューニング</div><div class="shop"><svg viewBox="0 0 200 120" width="220" height="130"><rect x="20" y="40" width="160" height="70" fill="#e8e8e6" stroke="#555" stroke-width="2"/><rect x="14" y="26" width="172" height="20" fill="#222"/><text x="100" y="41" text-anchor="middle" font-family="Arial Black" font-size="12" fill="#fff">TUNING SHOP</text><rect x="36" y="60" width="50" height="50" fill="#3a4a5a"/><rect x="104" y="58" width="62" height="52" fill="#9aa0a8"/></svg></div><div class="tp">+${tp} <small>TP</small></div><div class="bar"><span>所持 Tune POINT</span><b>${p.tp ?? 0}</b><em>pts.</em></div></div>
      <div class="pn"><div class="hd">走り屋グレード</div><div class="grade">${rankBadge(p.rp, 200)}</div><div class="bar"><span>${rankOf(p.rp).label}</span><b>${p.rp}</b><em>RP</em></div></div>`;
    const arc = f.arc, j = arc.episodes.indexOf(f.ep);
    const hasNext = won && (j < arc.episodes.length - 1 || f.season.arcs.indexOf(arc) < f.season.arcs.length - 1);
    const btns = won ? [hasNext && ['次の話へ', 'next'], ['チューニング', 'tune'], ['ストーリー選択', 'story']].filter(Boolean) : [['リトライ', 'retry'], ['チューニング', 'tune'], ['ストーリー選択', 'story']];
    $('.sr-btns', this.el).innerHTML = btns.map(([l, a], i) => `<div class="mtile ${i ? 'k' : 'y'}" data-a="${a}" style="width:300px;height:84px;font-size:26px">${l}</div>`).join('');
    this.tiles = $$('.sr-btns .mtile', this.el); this.bi = 0; this.mark();
    this.tiles.forEach((t, i) => t.onclick = () => { this.bi = i; this.act(); });
    this.el.classList.remove('reveal'); void this.el.offsetWidth; this.el.classList.add('reveal');
    Audio.playMusic('result'); Audio.stopEngines();
    setTimeout(() => { if (UI.current === this) Audio.ui(won ? 'coin' : 'back'); }, 600);
    if (rankAfter > rankBefore) setTimeout(() => { if (UI.current === this) Audio.ui('start'); }, 1300);
    startTimer($('.sr-tm', this.el), 15, () => this.act());
  },
  leave() { stopTimer(); },
  mark() { this.tiles.forEach((t, i) => t.classList.toggle('sel', i === this.bi)); },
  act() {
    stopTimer(); Audio.ui('ok');
    const a = this.tiles[this.bi].dataset.a, { f } = this.d;
    if (a === 'retry') return UI.go('storyintro', { epId: f.ep.id });
    if (a === 'tune') { App.hubReturn = 'story'; return UI.go('tuning', { uid: Save.activeCar.uid }); }
    if (a === 'next') {
      const arc = f.arc, j = arc.episodes.indexOf(f.ep);
      if (j < arc.episodes.length - 1) return UI.go('storyintro', { epId: arc.episodes[j + 1].id });
      return UI.go('story', { arc: f.season.arcs.indexOf(arc) + 1 });
    }
    UI.go('story', { arc: f.season.arcs.indexOf(f.arc) });
  },
  onAction(a) {
    if (a === 'left' || a === 'right') { this.bi = (this.bi + (a === 'left' ? -1 : 1) + this.tiles.length) % this.tiles.length; Audio.ui('move'); return this.mark(); }
    if (a === 'ok') return this.act();
  },
});
function fmtT(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}'${String(Math.floor(s)).padStart(2, '0')}"${String(Math.floor((s % 1) * 1000)).padStart(3, '0')}`; }
