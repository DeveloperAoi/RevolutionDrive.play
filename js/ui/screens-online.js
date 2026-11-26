// ONLINE BATTLE lobby: WORLDWIDE MATCH (auto matchmaking) / CODE BATTLE (create or join a room)
import { UI, $, $$, esc, dialog, toast, avatarSVG, rankBadge } from './core.js';
import { backdrop, plate, consoleBox, logoMark, keyGuide } from './frame.js';
import { carThumb, tuneLevel } from './screens-menu.js';
import { App } from '../app.js';
import { Audio } from '../audio/audio.js';
import { Save, rankOf } from '../core/save.js';
import { carById } from '../data/cars.js';
import { COURSES, courseById } from '../data/courses.js';
import { OnlineSession, onlineErr } from '../net/online.js';
import { LotScene } from '../game/gfx.js';

const TIMES = [['night', '夜'], ['dusk', '夕方'], ['day', '昼']];
function myInfo() {
  const p = Save.profile, gc = Save.activeCar;
  return { name: p.driverName, team: p.teamName, rp: p.rp, icon: p.icon || 0, carId: gc.carId, carName: gc.name, tune: gc.tune, setup: gc.setup || {}, dress: gc.dress, rankClass: rankOf(p.rp).ci, tl: tuneLevel(gc) };
}
const randCourse = () => {
  const ids = Save.profile.unlocked.courses; const c = courseById(ids[Math.floor(Math.random() * ids.length)]);
  return { courseId: c.id, dir: Math.random() < 0.5 ? 'fwd' : 'rev', weather: Math.random() < 0.15 ? 'rain' : 'clear', time: Math.random() < 0.6 ? c.time : TIMES[Math.floor(Math.random() * 3)][0] };
};
const courseLine = (c) => { const d = courseById(c.courseId); return `${d.jp} / ${d.dirs[c.dir][1]} / ${TIMES.find(t => t[0] === c.time)?.[1] || ''}${c.weather === 'rain' ? ' / 雨' : ''}`; };
const playerCard = (o, side) => `<div class="ol-pc ${side}"><div class="av">${avatarSVG(o.icon || 0, 120)}</div><div class="tx"><div class="team">${esc(o.team || '')}</div><div class="nm">${esc(o.name || 'DRIVER')}</div><div class="car"><img src="${carThumb(o.carId, o.dress)}"><span>${esc(o.carName || carById(o.carId).name)}</span></div></div><div class="rk">${rankBadge(o.rp || 0, 84)}</div></div>`;

UI.register({
  id: 'netlobby',
  build(n) {
    n.innerHTML = `${backdrop([[700, 24], [1896, 24], [1896, 930], [430, 930]], { tone: '#cfc8b6' })}
      <div class="af-title" style="left:800px;top:34px"><div class="t">ONLINE BATTLE</div><div class="ol-sub"></div></div>
      <div class="pp"></div><div class="ol-panel"></div>
      <div class="cbx"></div>${logoMark()}<div class="ol-keys"></div>`;
  },
  enter(params = {}) {
    this.kind = params.kind; this.state = 'init'; this.code = ''; this.sess = null; this.optI = 0;
    App.lot ||= new LotScene(App.gfx); App.lot.setPreset('cars'); App.gfx.setView(App.lot);
    $('.pp', this.el).innerHTML = plate(); $('.cbx', this.el).innerHTML = consoleBox();
    $('.ol-sub', this.el).textContent = { world: 'WORLDWIDE MATCH', create: 'CODE BATTLE — ルーム作成', join: 'CODE BATTLE — コード入力' }[this.kind];
    this.keys(this.kind === 'join' ? [['ud', ''], ['ok', '参加'], ['back', '戻る']] : [['back', 'キャンセル']]);
    this.onKey = (e) => { if (this.kind === 'join' && this.state === 'code') { if (/^[0-9]$/.test(e.key)) this.digit(e.key); if (e.key === 'Backspace') this.digit('del'); } };
    addEventListener('keydown', this.onKey);
    Audio.playMusic('menu');
    if (this.kind === 'join') { this.state = 'code'; this.renderCode(); }
    else this.start();
  },
  leave() { removeEventListener('keydown', this.onKey); clearInterval(this.anim); if (this.sess && !this.toRace) this.sess.leave(); this.toRace = false; },
  keys(list) { $('.ol-keys', this.el).innerHTML = keyGuide(list); },
  panel(html) { $('.ol-panel', this.el).innerHTML = html; },
  async fail(e) {
    console.warn('[online]', e); Audio.ui('error');
    if (this.sess) { this.sess.leave(); this.sess = null; }
    await dialog.alert('ONLINE BATTLE', esc(onlineErr(e)).replace(/&lt;br&gt;/g, '<br>'));
    if (UI.current === this) UI.go('online');
  },
  newSession() {
    const s = this.sess = new OnlineSession(myInfo());
    s.on('matched', (peer) => this.matched(peer));
    s.on('connected', (how) => { this.how = how; this.renderVS(); });
    s.on('synced', () => this.toRaceSoon());
    s.on('room', (r) => { if (this.kind === 'join' && this.state === 'vs') { this.course = r.course; this.renderVS(); } });
    s.on('closed', (why) => { if (UI.current === this && !this.toRace) { toast(why === 'peer-left' || why === 'room-deleted' ? '対戦相手が退出しました' : '接続が切れました'); UI.go('online'); } });
    s.on('error', (e) => this.fail(e));
    return s;
  },
  async start() {
    const s = this.newSession();
    try {
      if (this.kind === 'world') {
        this.course = randCourse(); this.searchT = Date.now(); this.renderSearch('search');
        this.anim = setInterval(() => this.renderSearch(this.state), 1000);
        await s.findMatch(this.course, (st) => { this.state = st; this.renderSearch(st); });
        if (s.role === 'guest') this.course = s.room?.course || this.course;
      } else if (this.kind === 'create') {
        this.course = randCourse(); this.panel('<div class="ol-msg">ルームを作成しています…</div>');
        const code = await s.createRoom({ pub: false, course: this.course }); this.code = code; this.state = 'wait'; this.renderHost();
        this.keys([['ud', '項目'], ['lr', '変更'], ['back', 'キャンセル']]);
      }
    } catch (e) { this.fail(e); }
  },
  renderSearch(st) {
    if (this.state === 'vs') return;
    const sec = Math.floor((Date.now() - (this.searchT || Date.now())) / 1000);
    this.panel(`<div class="ol-search"><div class="radar"><i></i><b></b></div><div class="big">${st === 'wait' ? '対戦相手を待っています' : st === 'found' ? 'MATCH FOUND!' : '対戦相手を検索中'}<span class="dots"></span></div>
      <div class="info">ランク ${rankOf(Save.profile.rp).label} 付近のプレイヤーを優先してマッチングします · 経過 ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</div>
      <div class="info">あなたのルームのコース:${courseLine(this.course)}</div></div>`);
  },
  renderHost() {
    if (this.state !== 'wait') return;
    const c = this.course, d = courseById(c.courseId);
    const rows = [['COURSE', d.jp], ['DIRECTION', d.dirs[c.dir][1]], ['WEATHER', c.weather === 'rain' ? '雨' : '晴れ'], ['TIME', TIMES.find(t => t[0] === c.time)[1]]];
    this.panel(`<div class="ol-host"><div class="lbl">ルームコード</div><div class="code">${this.code.split('').map(ch => `<i>${ch}</i>`).join('')}</div>
      <div class="hint">このコードを対戦相手に伝えてください。相手が「コード入力」から参加すると対戦が始まります。</div>
      <div class="opts">${rows.map(([l, v], k) => `<div class="opt ${k === this.optI ? 'focus' : ''}" data-k="${k}"><label>${l}</label><span class="arr">◀</span><span class="val">${v}</span><span class="arr">▶</span></div>`).join('')}</div>
      <div class="wait"><span class="spin"></span>対戦相手の参加を待っています…</div></div>`);
    $$('.ol-host .opt', this.el).forEach(o => o.onclick = (e) => { this.optI = +o.dataset.k; this.changeOpt(e.offsetX < o.clientWidth / 2 ? -1 : 1); });
  },
  changeOpt(dlt) {
    const c = this.course, ids = Save.profile.unlocked.courses;
    if (this.optI === 0) { const i = ids.indexOf(c.courseId); c.courseId = ids[(i + dlt + ids.length) % ids.length]; }
    if (this.optI === 1) c.dir = c.dir === 'fwd' ? 'rev' : 'fwd';
    if (this.optI === 2) c.weather = c.weather === 'rain' ? 'clear' : 'rain';
    if (this.optI === 3) { const i = TIMES.findIndex(t => t[0] === c.time); c.time = TIMES[(i + dlt + 3) % 3][0]; }
    Audio.ui('move'); this.sess.setCourse({ ...c }).catch(() => {}); this.renderHost();
  },
  renderCode() {
    const pad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
    this.panel(`<div class="ol-join"><div class="lbl">相手から聞いた6桁のルームコードを入力してください</div>
      <div class="code">${Array.from({ length: 6 }, (_, i) => `<i class="${i === this.code.length ? 'cur' : ''}">${this.code[i] || ''}</i>`).join('')}</div>
      <div class="pad">${pad.map(k => `<b data-k="${k}" class="${k === 'ok' ? 'ok' : k === 'del' ? 'del' : ''}">${k === 'del' ? '←' : k === 'ok' ? '参加' : k}</b>`).join('')}</div></div>`);
    $$('.ol-join .pad b', this.el).forEach(b => b.onclick = () => this.digit(b.dataset.k));
  },
  digit(k) {
    if (k === 'del') { this.code = this.code.slice(0, -1); Audio.ui('back'); }
    else if (k === 'ok') return this.join();
    else if (this.code.length < 6) { this.code += k; Audio.ui('move'); }
    this.renderCode();
    if (this.code.length === 6 && k !== 'del') this.join();
  },
  async join() {
    if (this.code.length !== 6) { Audio.ui('error'); return; }
    this.state = 'joining'; this.panel('<div class="ol-msg">ルームに参加しています…</div>');
    const s = this.newSession();
    try { await s.joinRoom(this.code); this.course = s.room?.course; } catch (e) { this.state = 'code'; this.fail(e); }
  },
  matched(peer) {
    clearInterval(this.anim); this.state = 'vs'; this.peer = peer; this.how = null;
    if (this.sess.room?.course) this.course = this.sess.room.course;
    Audio.ui('start'); this.keys([['back', 'キャンセル']]); this.renderVS();
  },
  renderVS() {
    if (this.state !== 'vs') return;
    this.panel(`<div class="ol-vs"><div class="mf">MATCH FOUND</div>${playerCard(myInfo(), 'l')}<div class="vs">VS</div>${playerCard(this.peer || {}, 'r')}
      <div class="crs">${courseLine(this.course)}</div>
      <div class="st">${this.how ? `<b style="color:#3dff8a">● 接続完了</b>(${this.how === 'p2p' ? 'P2P 直接接続' : 'リレー接続(低速)'}${this.sess.rtt ? ` · ${this.sess.rtt}ms` : ''})— まもなくスタート` : '<span class="spin"></span>対戦相手と接続しています…'}</div></div>`);
  },
  toRaceSoon() {
    if (this.toRace || UI.current !== this) return; this.renderVS();
    this.toRace = true;
    setTimeout(() => {
      if (UI.current !== this) return;
      const c = this.sess.room?.course || this.course;
      UI.go('race', { mode: 'battle', online: this.sess, courseId: c.courseId, dir: c.dir, weather: c.weather, time: c.time });
    }, 1800);
  },
  onAction(a) {
    if (a === 'back') { Audio.ui('back'); return UI.go('online'); }
    if (this.kind === 'create' && this.state === 'wait') {
      if (a === 'up' || a === 'down') { this.optI = (this.optI + (a === 'up' ? 3 : 1)) % 4; Audio.ui('move'); return this.renderHost(); }
      if (a === 'left' || a === 'right') return this.changeOpt(a === 'left' ? -1 : 1);
    }
    if (this.kind === 'join' && this.state === 'code' && a === 'ok') return this.join();
  },
});
