// Menus: MODE SELECT, CAR SELECT / registration, DRESS UP, GARAGE, TUNING, COURSE SELECT, SPECIAL, SETTINGS, PROFILE
import * as THREE from 'three';
import { OutputPass } from '../../lib/jsm/postprocessing/OutputPass.js';
import { UI, Focus, $, $$, el, esc, dialog, toast, sleep, startTimer, stopTimer, playerPlate, consolePlate, footer, rankBadge, avatarSVG } from './core.js';
import { App } from '../app.js';
import { Input } from '../core/input.js';
import { packReady } from '../world/glbCar.js';
import { Audio } from '../audio/audio.js';
import { Save, rankOf } from '../core/save.js';
import * as Net from '../net/firebase.js';
import { CARS, MAKERS, carById, buildSpec, carStats, topSpeedKmh, MAX_GARAGE } from '../data/cars.js';
import { COURSES, courseById } from '../data/courses.js';
import { Track } from '../world/track.js';
import { drawCourseMap, fmt } from '../game/hud.js';
import { createCar } from '../world/carModel.js';
import { tuneTotal, TUNE_PARTS_V2 } from '../data/custom.js';

const head = (title, jp, timer = true) => `<div class="topbar" style="padding-left:700px"><div class="title">${title}</div><div class="jp">${jp}</div></div>${timer ? '<div class="timer"><small>TIME</small><b>60</b></div>' : ''}`;
export const statBars = (st, cmp) => `<div class="specs">${[['POWER', 'power'], ['SPEED', 'speed'], ['ACCEL', 'accel'], ['HANDLING', 'handling'], ['BRAKE', 'brake']].map(([l, k]) => `<label>${l}</label><div class="bar"><i style="width:${Math.max(4, st[k] * 10)}%"></i>${cmp && cmp[k] > st[k] + 0.01 ? `<i class="up" style="left:${st[k] * 10}%;width:${(cmp[k] - st[k]) * 10}%"></i>` : ''}</div>`).join('')}</div>`;
export const tuneLevel = (gc) => { const n = tuneTotal(gc.tune); return n === 0 ? 'NORMAL' : n >= TUNE_PARTS_V2.length * 5 ? 'FULL TUNE' : `Tune Lv.${n}`; };
export const makerLogo = (mk) => { const m = MAKERS[mk]; return `<div style="display:flex;align-items:center;gap:16px"><div style="width:64px;height:64px;border-radius:50%;border:5px solid ${m.color};display:grid;place-items:center;font-style:italic;font-size:30px;color:${m.color}">${m.name[0]}</div><div><div style="font-size:44px;font-style:italic;color:${m.color};letter-spacing:2px;line-height:44px">${m.name}</div><div style="font-family:var(--jp);font-weight:900;font-size:20px;color:#444">${m.jp}</div></div></div>`; };

// thumbnails rendered once — with the main renderer into an offscreen target (a second WebGL context
// would keep its own copy of every car model / texture and pushes iPhones/iPads over their memory limit)
export const thumbCache = {};
let thumbR = null;
const TW = 400, TH = 225;
export function carThumb(carId, dress = {}) {
  const m = carById(carId).model; const key = carId + JSON.stringify(dress) + (m && packReady(m.pack) ? ':glb' : ''); if (thumbCache[key]) return thumbCache[key];
  let car = null;
  const r = App.gfx && App.gfx.renderer; if (!r) return '';
  const prevRT = r.getRenderTarget(), prevCol = r.getClearColor(new THREE.Color()), prevA = r.getClearAlpha(), prevShadow = r.shadowMap.enabled;
  try {
    if (!thumbR) {
      thumbR = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 100),
        rt: new THREE.WebGLRenderTarget(TW, TH, { type: THREE.HalfFloatType, samples: 4 }), out: new THREE.WebGLRenderTarget(TW, TH),
        pass: new OutputPass(), px: new Uint8Array(TW * TH * 4), cv: document.createElement('canvas') };
      thumbR.cv.width = TW; thumbR.cv.height = TH;
      thumbR.scene.environment = App.gfx.env;
      thumbR.scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.4)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(3, 5, 4); thumbR.scene.add(d);
      thumbR.cam.position.set(3.9, 1.7, 4.9); thumbR.cam.lookAt(0, 0.45, 0);
    }
    car = createCar(buildSpec(carById(carId)), dress, {}); car.root.rotation.y = 0.5; car.showcase(0);
    thumbR.scene.add(car.root);
    r.shadowMap.enabled = false; r.setClearColor(0x000000, 0);
    r.setRenderTarget(thumbR.rt); r.clear(); r.render(thumbR.scene, thumbR.cam);
    thumbR.pass.render(r, thumbR.out, thumbR.rt); // tone mapping + sRGB like the screen
    r.readRenderTargetPixels(thumbR.out, 0, 0, TW, TH, thumbR.px);
    const g = thumbR.cv.getContext('2d'), img = g.createImageData(TW, TH), src = thumbR.px, dst = img.data;
    for (let y = 0; y < TH; y++) { // flip vertically, un-premultiply alpha
      let si = (TH - 1 - y) * TW * 4, di = y * TW * 4;
      for (let x = 0; x < TW; x++, si += 4, di += 4) { const a = src[si + 3]; const k = a ? 255 / a : 0; dst[di] = Math.min(255, src[si] * k); dst[di + 1] = Math.min(255, src[si + 1] * k); dst[di + 2] = Math.min(255, src[si + 2] * k); dst[di + 3] = a; }
    }
    g.putImageData(img, 0, 0);
    const ks = Object.keys(thumbCache); if (ks.length > 60) for (const k of ks.slice(0, ks.length - 60)) delete thumbCache[k]; // keep the cache bounded
    return (thumbCache[key] = thumbR.cv.toDataURL('image/png'));
  } catch (e) { console.warn(e); return ''; }
  finally {
    r.setRenderTarget(prevRT); r.setClearColor(prevCol, prevA); r.shadowMap.enabled = prevShadow;
    if (car) { thumbR.scene.remove(car.root); car.dispose(); }
  }
}

// ───────────────────────── SPECIAL EVENTS ─────────────────────────
export const EVENTS = [
  { id: 'ev_rain', name: 'RAINY NIGHT CHALLENGE', jp: '雨の流星サーキット', desc: '雨の流星サーキット2周を目標タイム以内で走り切れ。', courseId: 'ryusei', dir: 'fwd', weather: 'rain', target: 150, reward: 3000, until: '2026-12-31' },
  { id: 'ev_down', name: 'AKANE DOWNHILL ATTACK', jp: '赤嶺峠 ダウンヒルアタック', desc: '赤嶺峠の下りを目標タイム以内で。ヘアピンの立ち上がりが鍵。', courseId: 'akane', dir: 'fwd', weather: 'clear', target: 140, reward: 2500, until: '2026-12-31' },
  { id: 'ev_up', name: 'SKYLINE HILLCLIMB', jp: '白波スカイライン 上り', desc: '白波スカイラインの上りで目標タイムを切れ。パワーとライン取りの勝負。', courseId: 'shiranami', dir: 'fwd', weather: 'clear', target: 105, reward: 2500, until: '2026-12-31' },
];
UI.register({
  id: 'special',
  build(n) { n.innerHTML = `<div class="bg-metal"></div>${head('SPECIAL', '期間限定イベント', false)}<div class="gpanel" style="left:120px;width:1680px;top:180px"><div class="glist"></div></div>${footer([['↑↓', '選択'], ['ENTER', '挑戦'], ['ESC', '戻る']])}`; },
  enter() {
    App.gfx.setView(null);
    const done = Save.profile.flags.events || {};
    $('.glist', this.el).innerHTML = EVENTS.map(e => { const c = courseById(e.courseId); const best = done[e.id]; return `<div class="gitem" style="height:150px;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px"><div style="font-size:36px">${e.name} <span style="font-family:var(--jp);font-size:24px;color:#ffd400">${e.jp}</span></div><div style="font-family:var(--jp);font-weight:900;font-size:22px;color:#ccc;font-style:normal">${e.desc} — 目標 ${fmt(e.target)} / 報酬 ¥${e.reward.toLocaleString()} / ${c.jp} / 期限 ${e.until}</div><div style="font-size:22px;color:${best?.cleared ? '#3dff8a' : '#888'}">${best?.cleared ? 'CLEARED ✔ ベスト ' + fmt(best.best) : best ? 'ベスト ' + fmt(best.best) : '未挑戦'}</div></div>`; }).join('');
    this.focus = new Focus($$('.gitem', this.el), { axis: 'v', onSelect: (i) => { const e = EVENTS[i]; Audio.ui('start'); App.pending.event = e; UI.go('race', { mode: 'trial', courseId: e.courseId, dir: e.dir, weather: e.weather, event: e }); } });
  },
  onAction(a) { if (a === 'back') { Audio.ui('back'); App.pending.event = null; return UI.go('mode'); } this.focus.action(a); },
});

// ───────────────────────── SETTINGS ─────────────────────────
UI.register({
  id: 'settings',
  build(n) { n.innerHTML = `<div class="bg-metal"></div>${head('SETTINGS', '設定', false)}<div class="opt-row s-opts" style="left:120px;right:auto;width:900px;top:140px;gap:6px"></div>
    <div style="position:absolute;left:1080px;right:80px;top:160px;font-family:var(--jp);font-weight:900;font-size:22px;line-height:36px;color:#bbb;background:rgba(0,0,0,.5);padding:16px 24px;border-left:4px solid var(--orange)">
    操作:←→ ステアリング / ↑ アクセル / ↓ ブレーキ・バック / SPACE サイドブレーキ / E・Q シフトアップ・ダウン(MT) / C カメラ切替 / R コース復帰 / ESC ポーズ<br>ゲームパッド:左スティック ステア / RT アクセル / LT ブレーキ / A サイドブレーキ / RB・LB シフト</div>
    ${footer([['↑↓', '項目'], ['←→', '変更'], ['ESC', '戻る']])}`; },
  enter(params = {}) {
    App.gfx.setView(null); this.back = params.back || 'mode'; this.i = 0; this.render();
  },
  rows() {
    const s = App.settings;
    return [
      ['BGM VOLUME', 'slider', 'bgm'], ['SE VOLUME', 'slider', 'sfx'], ['GUIDE SE (0=OFF)', 'slider', 'guideSe'],
      ['TRANSMISSION', s.autoGear ? 'AT オートマ' : 'MT マニュアル', 'autoGear'],
      ['DRIFT ASSIST', 'slider', 'assist'],
      ['EASY DRIFT', ['OFF', 'LIGHT 少しアシスト', 'FULL 簡単ドリフト'][s.easyDrift ?? 1], 'easyDrift'],
      ['CAMERA', ['CHASE', 'FAR', 'BUMPER'][s.camera], 'camera'],
      ['TOUCH CONTROLS', { auto: 'AUTO', on: 'ON', off: 'OFF' }[s.touch], 'touch'],
      ['TOUCH STEERING', { button: 'ボタン', slide: 'スライド', tilt: '傾き(ジャイロ)' }[s.touchSteer || 'button'], 'touchSteer'],
      ['CUSTOMIZE TIMER', s.custTimer ? '3:00 制限あり' : '制限なし', 'custTimer'],
      ['PERSONAL GHOST', s.ghost === false ? 'OFF' : 'ON', 'ghost'],
      ['GHOST OPACITY', 'slider', 'ghostOp10'],
      ['GHOST COLOR', { '#7af0ff': 'CYAN', '#ffffff': 'WHITE', '#ffd400': 'YELLOW', '#ff5ad0': 'PINK', '#5aff7a': 'GREEN' }[s.ghostColor || '#7af0ff'], 'ghostColor'],
      ['LINE GUIDE', s.lineGuide ? 'ON' : 'OFF', 'lineGuide'],
      ['CAMERA SHAKE', 'slider', 'camShake'],
      ['GRAPHICS', (s.gfx || (App.isTouch ? 'low' : 'high')) === 'low' ? 'LOW 軽量 (スマホ推奨)' : 'HIGH 高画質 (影・ブルーム)', 'gfx'],
    ];
  },
  render() {
    const s = App.settings; s.ghostOp10 ??= 4; s.camShake ??= 6; s.guideSe ??= 7;
    $('.s-opts', this.el).innerHTML = this.rows().map(([l, v, k]) => `<div class="opt"><label>${l}</label><span class="arr">◀</span>${v === 'slider' ? `<span class="slider">${Array.from({ length: 10 }, (_, i) => `<i class="${i < s[k] ? 'on' : ''}"></i>`).join('')}</span>` : `<span class="val">${v}</span>`}<span class="arr">▶</span></div>`).join('') + `<div class="opt" style="justify-content:center"><span class="val">◀ 戻る</span></div>`;
    $$('.s-opts .opt', this.el).forEach((o, k) => { o.classList.toggle('focus', k === this.i); o.onclick = (e) => { this.i = k; if (k === this.rows().length) return this.exit(); this.change(e.offsetX < o.clientWidth / 2 ? -1 : 1); }; });
  },
  change(d) {
    const s = App.settings; const k = this.rows()[this.i]?.[2]; if (!k) return;
    if (k === 'bgm' || k === 'sfx' || k === 'assist' || k === 'guideSe') { s[k] = Math.max(0, Math.min(10, (s[k] ?? 7) + d)); if (k === 'guideSe') setTimeout(() => Audio.guideSE('curve', 0), 50); }
    if (k === 'autoGear') s.autoGear = !s.autoGear;
    if (k === 'easyDrift') s.easyDrift = ((s.easyDrift ?? 1) + d + 3) % 3;
    if (k === 'custTimer') s.custTimer = !s.custTimer;
    if (k === 'ghost') s.ghost = s.ghost === false;
    if (k === 'lineGuide') s.lineGuide = !s.lineGuide;
    if (k === 'ghostOp10') { s.ghostOp10 = Math.max(1, Math.min(9, (s.ghostOp10 ?? 4) + d)); s.ghostOpacity = s.ghostOp10 / 10; }
    if (k === 'camShake') s.camShake = Math.max(0, Math.min(10, (s.camShake ?? 6) + d));
    if (k === 'ghostColor') { const o = ['#7af0ff', '#ffffff', '#ffd400', '#ff5ad0', '#5aff7a']; s.ghostColor = o[(o.indexOf(s.ghostColor || '#7af0ff') + d + o.length) % o.length]; }
    if (k === 'camera') s.camera = (s.camera + d + 3) % 3;
    if (k === 'gfx') s.gfx = (s.gfx || (App.isTouch ? 'low' : 'high')) === 'low' ? 'high' : 'low';
    if (k === 'touchSteer') { const o = ['button', 'slide', 'tilt']; s.touchSteer = o[(o.indexOf(s.touchSteer || 'button') + d + 3) % 3]; if (s.touchSteer === 'tilt') Input.enableTilt(true).then(ok => { if (!ok) { s.touchSteer = 'button'; this.render(); toast('傾きセンサーを使用できません'); } }); }
    if (k === 'touch') { const o = ['auto', 'on', 'off']; s.touch = o[(o.indexOf(s.touch) + d + 3) % 3]; }
    App.applySettings(); Audio.ui('move'); if (Save.profile) Save.touch('settings'); this.render();
  },
  exit() { Audio.ui('back'); UI.go(this.back); },
  onAction(a) {
    const n = this.rows().length + 1;
    if (a === 'back') return this.exit();
    if (a === 'up') { this.i = (this.i - 1 + n) % n; Audio.ui('move'); this.render(); }
    if (a === 'down') { this.i = (this.i + 1) % n; Audio.ui('move'); this.render(); }
    if (a === 'left' || a === 'right') this.change(a === 'left' ? -1 : 1);
    if (a === 'ok' && this.i === n - 1) this.exit(); else if (a === 'ok') this.change(1);
  },
});

// ───────────────────────── PROFILE / ACCOUNT STATUS ─────────────────────────
UI.register({
  id: 'profile',
  build(n) { n.innerHTML = `<div class="bg-metal"></div>${head('PROFILE', 'プロフィール', false)}<div class="pf" style="position:absolute;left:120px;right:120px;top:170px;bottom:120px"></div>${footer([['←→', '選択'], ['ENTER', '決定'], ['ESC', '戻る']])}`; },
  enter() {
    App.gfx.setView(null);
    const p = Save.profile; const r = rankOf(p.rp); const u = Net.currentUser;
    const recs = Object.entries(p.records);
    const syncTxt = { local: 'この端末に保存済み', saving: '保存中…', synced: 'クラウドと同期済み', pending: '同期待ち(オフライン時はローカルに保持し、再接続後に自動再送)', error: '同期エラー(ローカルに保持中)' }[Save.status];
    $('.pf', this.el).innerHTML = `
      <div style="display:flex;gap:40px">
        <div style="width:760px;padding:30px;background:rgba(8,10,14,.85);border:2px solid #333">
          <div style="display:flex;gap:24px;align-items:center">${avatarSVG(p.icon, 150)}<div><div style="font-size:60px;font-style:italic">${esc(p.driverName)}</div><div style="font-family:var(--jp);font-weight:900;font-size:28px;color:var(--orange2)">${esc(p.teamName)}</div></div><div style="margin-left:auto">${rankBadge(p.rp, 130)}</div></div>
          <div class="xpbar" style="margin:22px 0 4px"><i style="width:${r.progress * 100}%"></i></div><div style="font-size:18px;color:#aaa">RANK ${r.label} · ${p.rp} RP · 次のランクまで ${Math.round((1 - r.progress) * 300)} RP</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:20px;font-style:italic">${[['RACES', p.stats.races], ['WINS', p.stats.wins], ['TRIALS', p.stats.trials], ['DISTANCE', p.stats.km.toFixed(1) + ' km'], ['CREDITS', '¥' + p.credits.toLocaleString()], ['CARS', p.cars.length + '/5']].map(([k, v]) => `<div style="background:#14171c;padding:10px 16px"><div style="font-size:16px;color:#888">${k}</div><div style="font-size:32px">${v}</div></div>`).join('')}</div>
          <div style="margin-top:20px;font-size:20px;color:#aaa">BEST TIMES</div><div style="font-size:22px;line-height:34px;font-style:italic">${recs.length ? recs.map(([k, v]) => `${courseById(k.split(':')[0]).jp} ${courseById(k.split(':')[0]).dirs[k.split(':')[1]][1]} — <b>${fmt(v.best)}</b>`).join('<br>') : '—'}</div>
        </div>
        <div style="flex:1;padding:30px;background:rgba(8,10,14,.85);border:2px solid #333;font-family:var(--jp);font-weight:900;font-size:26px;line-height:46px">
          <div style="font-family:var(--font);font-size:22px;color:#9cf">ACCOUNT STATUS</div>
          <div>プレイ方式:<span style="color:${Save.mode === 'account' ? '#36c3ff' : '#ff9a40'}">${Save.mode === 'account' ? 'ACCOUNT PLAY' : 'GUEST PLAY(端末内保存)'}</span></div>
          ${u && Save.mode === 'account' ? `<div>アカウント:${esc(u.email)}</div>` : ''}
          <div>最終セーブ:${Save.lastSave ? new Date(Save.lastSave).toLocaleString('ja-JP') : new Date(p.updatedAt).toLocaleString('ja-JP')}</div>
          <div>同期状態:<span data-sync-text>${syncTxt}</span></div>
          <div class="row pf-btns" style="margin-top:26px;gap:16px"></div>
        </div></div>`;
    const btns = [['名前・アイコン変更', 'rename', 'primary']];
    if (Save.mode === 'account') btns.push(['今すぐ同期', 'sync', 'blue'], ['ログアウト', 'logout', 'dark'], ['アカウント削除', 'delete', 'dark']);
    else btns.push(['アカウント登録・引き継ぎ', 'account', 'blue']);
    btns.push(['戻る', 'back', 'dark']);
    $('.pf-btns', this.el).innerHTML = btns.map(([l, a, c]) => `<button class="btn small ${c}" data-a="${a}" style="font-family:var(--jp);font-weight:900">${l}</button>`).join('');
    this.focus = new Focus($$('.pf-btns .btn', this.el), { axis: 'h', onSelect: (i, b) => this.run(b.dataset.a) });
  },
  async run(a) {
    if (a === 'back') { Audio.ui('back'); return UI.go(App.takeReturn('mode')); }
    if (a === 'rename') { Audio.ui('ok'); return UI.go('name', { edit: 'driver' }); }
    if (a === 'sync') { await Save.persistNow('manual'); toast(Save.status === 'synced' ? 'クラウドと同期しました' : '同期できませんでした。ローカルに保持し、自動で再試行します'); return this.enter(); }
    if (a === 'account') {
      if (!Net.isConfigured()) return dialog.alert('ACCOUNT', 'ゲームサーバーが未設定のため、現在アカウント機能はご利用いただけません。');
      await Save.persistNow('pre-migrate');
      return UI.go('account', { from: 'profile', view: 'register' });
    }
    if (a === 'logout') {
      if (!(await dialog.confirm('ログアウト', 'ログアウトしてタイトルに戻りますか?<br>データはクラウドに保存されています。', 'ログアウト', 'キャンセル'))) return;
      await Save.persistNow('logout'); await Net.logout(); Save.profile = null; Save.setGuest(); toast('ログアウトしました'); return UI.go('title');
    }
    if (a === 'delete') {
      const pw = await this.askPassword(); if (pw == null) return;
      if (!(await dialog.confirm('アカウント削除', '<span style="color:#ff6a6a">アカウントとクラウド上のすべてのセーブデータを削除します。<br>この操作は元に戻せません。</span>', '完全に削除', 'キャンセル'))) return;
      try { await Net.deleteAccount(pw, COURSES.flatMap(c => [`${c.id}_fwd`, `${c.id}_rev`])); Save.profile = null; Save.setGuest(); await dialog.alert('削除完了', 'アカウントを削除しました。'); UI.go('title'); }
      catch (e) { dialog.alert('エラー', Net.errText(e)); }
    }
  },
  askPassword() {
    return new Promise(res => {
      dialog.show({ title: '本人確認', text: '安全のため、パスワードを入力してください。', html: '<label class="field" style="margin-top:20px"><input type="password" id="pw-confirm" autocomplete="current-password"></label>', buttons: [{ label: '確認', value: 'ok', cls: 'primary' }, { label: 'キャンセル', value: null, cls: 'dark', cancel: true }] })
        .then(v => res(v === 'ok' ? this._pw : null));
      setTimeout(() => { const i = $('#pw-confirm'); if (i) { i.focus(); i.oninput = () => this._pw = i.value; } }, 60);
    });
  },
  onAction(a) { if (a === 'back') { Audio.ui('back'); return UI.go(App.takeReturn('mode')); } this.focus.action(a); },
});
