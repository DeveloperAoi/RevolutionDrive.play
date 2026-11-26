// Menus: MODE SELECT, CAR SELECT / registration, DRESS UP, GARAGE, TUNING, COURSE SELECT, SPECIAL, SETTINGS, PROFILE
import * as THREE from 'three';
import { UI, Focus, $, $$, el, esc, dialog, toast, sleep, startTimer, stopTimer, playerPlate, consolePlate, footer, rankBadge, avatarSVG } from './core.js';
import { App } from '../app.js';
import { Audio } from '../audio/audio.js';
import { Save, rankOf } from '../core/save.js';
import * as Net from '../net/firebase.js';
import { CARS, MAKERS, carById, buildSpec, carStats, topSpeedKmh, PAINTS, WHEELS, SPOILERS, AEROS, MUFFLERS, DECALS, RIDE_HEIGHTS, TUNE_PARTS, MAX_GARAGE } from '../data/cars.js';
import { COURSES, courseById } from '../data/courses.js';
import { Track } from '../world/track.js';
import { drawCourseMap, fmt } from '../game/hud.js';
import { createCar } from '../world/carModel.js';

const head = (title, jp, timer = true) => `<div class="topbar" style="padding-left:700px"><div class="title">${title}</div><div class="jp">${jp}</div></div>${timer ? '<div class="timer"><small>TIME</small><b>60</b></div>' : ''}`;
const statBars = (st, cmp) => `<div class="specs">${[['POWER', 'power'], ['SPEED', 'speed'], ['ACCEL', 'accel'], ['HANDLING', 'handling'], ['BRAKE', 'brake']].map(([l, k]) => `<label>${l}</label><div class="bar"><i style="width:${Math.max(4, st[k] * 10)}%"></i>${cmp && cmp[k] > st[k] + 0.01 ? `<i class="up" style="left:${st[k] * 10}%;width:${(cmp[k] - st[k]) * 10}%"></i>` : ''}</div>`).join('')}</div>`;
const tuneLevel = (gc) => { const t = gc.tune || {}; const sum = Object.keys(TUNE_PARTS).reduce((s, k) => s + (t[k] || 0), 0); const max = Object.keys(TUNE_PARTS).length * 3; return sum === 0 ? 'STOCK' : sum === max ? 'FULL TUNE' : `TUNE Lv.${sum}`; };
const makerLogo = (mk) => { const m = MAKERS[mk]; return `<div style="display:flex;align-items:center;gap:16px"><div style="width:64px;height:64px;border-radius:50%;border:5px solid ${m.color};display:grid;place-items:center;font-style:italic;font-size:30px;color:${m.color}">${m.name[0]}</div><div><div style="font-size:44px;font-style:italic;color:${m.color};letter-spacing:2px;line-height:44px">${m.name}</div><div style="font-family:var(--jp);font-weight:900;font-size:20px;color:#444">${m.jp}</div></div></div>`; };

// thumbnails rendered once with a tiny offscreen renderer
const thumbCache = {};
let thumbR = null;
function carThumb(carId, dress = { paint: 'white' }) {
  const key = carId + JSON.stringify(dress); if (thumbCache[key]) return thumbCache[key];
  try {
    if (!thumbR) {
      thumbR = { r: new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }), scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 100) };
      thumbR.r.setSize(400, 225); thumbR.r.toneMapping = THREE.ACESFilmicToneMapping; thumbR.r.outputColorSpace = THREE.SRGBColorSpace;
      thumbR.scene.environment = App.gfx.env;
      thumbR.scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.4)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(3, 5, 4); thumbR.scene.add(d);
      thumbR.cam.position.set(3.9, 1.7, 4.9); thumbR.cam.lookAt(0, 0.45, 0);
    }
    const car = createCar(buildSpec(carById(carId)), dress, {}); car.root.rotation.y = 0.5; car.showcase(0);
    thumbR.scene.add(car.root); thumbR.r.render(thumbR.scene, thumbR.cam);
    const url = thumbR.r.domElement.toDataURL('image/png');
    thumbR.scene.remove(car.root); car.dispose();
    return (thumbCache[key] = url);
  } catch (e) { console.warn(e); return ''; }
}

// ───────────────────────── MODE SELECT ─────────────────────────
const MODES = [
  { id: 'trial', name: 'TIME TRIAL', jp: 'タイムトライアル', desc: 'ひとりでコースを全開走行。自己ベストとゴーストに挑み、セクションタイムを削り取れ!', reward: 'クレジット / RP / 新記録ボーナス', grad: ['#1a3a6a', '#0a1428'], on: true },
  { id: 'special', name: 'SPECIAL', jp: 'スペシャル', desc: '期間限定のチャレンジイベント。指定の条件で目標タイムを切れば特別報酬!', reward: '高額クレジット', grad: ['#5a1a6a', '#1a0a28'], on: true },
  { id: 'story', name: 'STORY', jp: 'ストーリー', desc: '各地の峠に君臨する走り屋たちとのバトル。チャプターを進めて伝説を目指せ。', reward: 'ストーリー報酬', grad: ['#6a3a0a', '#28140a'], on: false },
  { id: 'battle', name: 'COURSE BATTLE', jp: 'コースバトル', desc: 'CPUライバルと1対1のバトル。難易度を選んで、峠の頂点を奪い取れ!', reward: '勝利ボーナス / RP', grad: ['#6a0a1a', '#28060a'], on: true },
  { id: 'local', name: 'LOCAL BATTLE', jp: 'ローカルバトル', desc: '同じ端末・同じネットワーク内のプレイヤーと対戦。', reward: '—', grad: ['#0a5a3a', '#06281a'], on: false },
  { id: 'online', name: 'ONLINE BATTLE', jp: 'オンラインバトル', desc: 'CODE BATTLE(ルームコード対戦)と WORLDWIDE MATCH(世界マッチング)。', reward: 'オンラインRP', grad: ['#0a4a6a', '#061a28'], on: false },
  { id: 'garage', name: 'GARAGE', jp: 'ガレージ', desc: '登録車両の切替・追加登録(最大5台)・ドレスアップ・チューニング。', reward: '', grad: ['#3a3a3a', '#111'], on: true },
  { id: 'profile', name: 'PROFILE', jp: 'プロフィール', desc: 'プレイヤー情報・戦績・アカウント状態・同期状態の確認。', reward: '', grad: ['#2a2a4a', '#0a0a18'], on: true },
  { id: 'settings', name: 'SETTINGS', jp: '設定', desc: 'BGM・効果音の音量、トランスミッション、ドリフトアシスト、カメラ、タッチ操作。', reward: '', grad: ['#2a3a2a', '#0a140a'], on: true },
];
const modeArt = (m, big) => `background:
  radial-gradient(ellipse at 70% 40%, ${m.grad[0]}ee, transparent 70%),
  repeating-linear-gradient(115deg, rgba(255,255,255,.06) 0 ${big ? 6 : 3}px, transparent ${big ? 6 : 3}px ${big ? 26 : 14}px),
  linear-gradient(160deg, ${m.grad[0]}, ${m.grad[1]})`;

UI.register({
  id: 'mode',
  build(n) {
    n.innerHTML = `<div class="bg-metal"></div><div class="pp"></div>
      <div class="topbar" style="padding-left:700px;background:none;border:none"><div class="title">MODE SELECT</div></div><div class="timer"><small>TIME</small><b>60</b></div>
      <div class="mode-left" style="position:absolute;left:40px;top:380px;width:560px;padding:26px 30px;background:linear-gradient(90deg,rgba(0,90,120,.75),rgba(0,40,60,.4));border-left:6px solid var(--blue2);clip-path:polygon(0 0,100% 0,94% 100%,0 100%);font-family:var(--jp);font-weight:900;font-size:26px;line-height:42px"></div>
      <div class="mode-big" style="position:absolute;left:650px;top:150px;right:40px;height:600px;clip-path:polygon(60px 0,100% 0,100% 100%,0 100%);border:4px solid #aab;overflow:hidden">
        <div class="art" style="position:absolute;inset:0"></div><canvas class="mode-cv" width="1230" height="600" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
        <div class="mbtxt" style="position:absolute;right:60px;bottom:70px;text-align:right"></div>
        <div style="position:absolute;left:0;right:0;bottom:0;height:56px;background:rgba(0,0,0,.6);text-align:center;font-family:var(--jp);font-weight:900;font-size:28px;line-height:56px">モードを選択してください</div></div>
      <div class="modes-strip" style="position:absolute;left:30px;right:30px;top:780px;height:170px;display:flex;gap:10px;justify-content:center"></div>
      ${consolePlate()}${footer([['←→', '選択'], ['ENTER', '決定'], ['ESC', '戻る']])}`;
  },
  enter() {
    App.gfx.setView(App.showroom); const car = Save.activeCar; if (car) App.showroom.setCar(App.specOf(car), car.dress);
    $('.pp', this.el).innerHTML = playerPlate();
    this.el.querySelector('.console')?.remove(); this.el.insertAdjacentHTML('beforeend', consolePlate());
    const strip = $('.modes-strip', this.el);
    strip.innerHTML = MODES.map(m => `<div class="mcard" style="position:relative;width:196px;height:150px;cursor:pointer;clip-path:polygon(22px 0,100% 0,calc(100% - 22px) 100%,0 100%);${modeArt(m)};transition:.18s;flex:none">
      <div style="position:absolute;left:24px;top:10px;font-size:15px;font-style:italic;color:#ddd">${m.name}</div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:50px;background:linear-gradient(90deg,${m.on ? '#2a8a3a,#7fdc4a' : '#555,#888'});clip-path:polygon(22px 0,100% 0,calc(100% - 22px) 100%,0 100%);display:grid;place-items:center;font-family:var(--jp);font-weight:900;font-size:22px;color:#fff;text-shadow:0 2px 0 #000">${m.jp}</div>
      ${!m.on ? '<div style="position:absolute;right:26px;top:40px;font-size:16px;color:#ffd400">準備中</div>' : ''}</div>`).join('');
    const cards = $$('.mcard', strip);
    const style = () => cards.forEach((c, k) => { const f = k === this.focus.i; c.style.transform = f ? 'translateY(-14px) scale(1.08)' : ''; c.style.outline = f ? '4px solid #ffd400' : 'none'; c.style.filter = f ? 'drop-shadow(0 0 18px #fa0)' : 'brightness(.8)'; c.style.zIndex = f ? 2 : 1; });
    this.focus = new Focus(cards, { axis: 'h', index: this.last || 0, onChange: (i) => { this.show(i); style(); }, onSelect: (i) => this.pick(i) });
    const ap = this.focus.apply.bind(this.focus); this.focus.apply = () => { ap(); style(); };
    this.show(this.focus.i); style();
    Audio.playMusic('menu');
    startTimer($('.timer', this.el), 60, () => this.pick(0));
  },
  show(i) {
    const m = MODES[i]; this.last = i;
    $('.art', this.el).style.cssText = `position:absolute;inset:0;${modeArt(m, true)}`;
    $('.mbtxt', this.el).innerHTML = `<div style="font-size:30px;font-style:italic;color:#ddd">${m.on ? 'SELECT' : 'COMING SOON'}</div><div style="font-size:110px;line-height:110px;font-style:italic;text-shadow:0 6px 0 #000,0 0 30px ${m.grad[0]}">${m.name}</div><div style="font-family:var(--jp);font-weight:900;font-size:40px;color:#ffd400;text-shadow:0 3px 0 #000">${m.jp}</div>`;
    $('.mode-left', this.el).innerHTML = `${esc(m.desc)}${m.reward ? `<div style="margin-top:16px;padding:6px 16px;background:rgba(255,200,0,.2);border-left:4px solid #ffd400">報酬: ${esc(m.reward)}</div>` : ''}${!m.on ? '<div style="margin-top:16px;color:#ffd400">※ 現在プレイできません(今後のアップデートで解放予定)</div>' : ''}`;
    this.drawArt(m);
  },
  drawArt(m) {
    const c = $('.mode-cv', this.el), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    // stylised speed lines + emblem silhouettes per mode
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) { const y = Math.random() * 600; g.strokeStyle = `rgba(255,${150 + Math.random() * 100},60,${0.05 + Math.random() * 0.15})`; g.lineWidth = 1 + Math.random() * 3; g.beginPath(); g.moveTo(Math.random() * 400, y); g.lineTo(1230, y - 80); g.stroke(); }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.08)'; g.font = 'italic 900 260px Arial Black'; g.textAlign = 'left'; g.fillText({ trial: '⏱', special: '★', story: '章', battle: 'VS', local: 'LAN', online: 'NET', garage: 'GRG', profile: 'ID', settings: '⚙' }[m.id] || '', 60, 330);
  },
  async pick(i) {
    const m = MODES[i]; stopTimer();
    if (!m.on) {
      Audio.ui('error');
      const extra = m.id === 'online' ? '<br><br><b style="color:#36c3ff">CODE BATTLE</b>:ルームコードを発行してフレンドと対戦<br><b style="color:#36c3ff">WORLDWIDE MATCH</b>:ランク別の自動マッチング<br>' + (Net.isConfigured() ? '' : '<br>※ サーバー設定後に有効になります。') : '';
      await dialog.alert(m.name, `「${m.jp}」は現在プレイできません。<br>今後のアップデートで解放予定です。${extra}`);
      return startTimer($('.timer', this.el), 60, () => this.pick(0));
    }
    Audio.ui('ok');
    if (m.id === 'trial' || m.id === 'battle') { App.pending.mode = m.id; App.pending.event = null; UI.go('course'); }
    else if (m.id === 'special') UI.go('special');
    else if (m.id === 'garage') UI.go('garage');
    else if (m.id === 'profile') UI.go('profile');
    else if (m.id === 'settings') UI.go('settings', { back: 'mode' });
  },
  async onAction(a) {
    if (a === 'back') {
      stopTimer();
      const ok = await dialog.confirm('タイトルに戻る', 'タイトル画面に戻りますか?<br>(データは自動保存されています)', '戻る', 'キャンセル');
      if (ok) { await Save.persistNow('exit'); UI.go('title'); } else startTimer($('.timer', this.el), 60, () => this.pick(0));
      return;
    }
    this.focus.action(a);
  },
});

// ───────────────────────── CAR SELECT (register / add) ─────────────────────────
UI.register({
  id: 'carselect',
  build(n) {
    n.innerHTML = `<div class="rotzone" style="position:absolute;inset:150px 0 330px 0"></div><div class="pp"></div>
      <div class="topbar" style="padding-left:700px;background:linear-gradient(180deg,rgba(0,0,0,.6),transparent);border:none"><div class="title">CAR SELECT</div><div class="jp cs-sub"></div></div><div class="timer"><small>TIME</small><b>60</b></div>
      <div class="cs-maker" style="position:absolute;left:0;top:190px;width:560px;height:150px;padding:0 40px;display:flex;align-items:center;background:linear-gradient(90deg,#fff,#dfe3e8);clip-path:polygon(0 0,100% 0,92% 100%,0 100%);color:#111"></div>
      <div class="cs-left" style="position:absolute;left:30px;top:370px;width:520px;font-family:var(--jp);font-weight:900;font-size:24px;line-height:38px"></div>
      <div class="cs-info" style="position:absolute;right:40px;top:160px;width:600px;padding:16px 30px;background:linear-gradient(180deg,#fff,#e4e7eb);color:#111;border-radius:6px 6px 40px 6px;box-shadow:0 8px 0 #000"></div>
      <div class="cs-stats" style="position:absolute;right:40px;top:520px;width:600px;padding:16px 30px;background:rgba(6,8,12,.85);border:2px solid #333"></div>
      <div style="position:absolute;left:0;right:0;top:720px;text-align:center;font-family:var(--jp);font-weight:900;font-size:26px;text-shadow:0 2px 0 #000" class="cs-hint">クルマを選んでください(ドラッグで回転)</div>
      <div class="cs-strip" style="position:absolute;left:0;right:0;top:770px;height:190px;display:flex;gap:12px;justify-content:center;background:linear-gradient(90deg,transparent,rgba(0,0,0,.6) 15%,rgba(0,0,0,.6) 85%,transparent);padding-top:14px"></div>
      <div class="cs-menu" style="position:absolute;left:0;right:0;top:770px;height:190px;display:none;gap:16px;justify-content:center;align-items:center"></div>
      ${footer([['←→', '選択'], ['ENTER', '決定'], ['ESC', '戻る']])}`;
  },
  enter(params = {}) {
    this.mode = params.mode || 'add';
    App.gfx.setView(App.showroom); App.showroom.frameFor(0);
    $('.pp', this.el).innerHTML = playerPlate();
    $('.cs-sub', this.el).textContent = this.mode === 'register' ? '最初の1台を登録しよう' : `車両追加登録 (${Save.profile.cars.length}/${MAX_GARAGE})`;
    if (this.mode === 'add' && !Save.canAddCar()) { dialog.alert('CAR ADD', `登録可能な車両は最大${MAX_GARAGE}台です。<br>ガレージで車両を削除すると空き枠を作れます。`).then(() => UI.go('garage')); return; }
    // sort by maker
    this.list = CARS.slice().sort((a, b) => a.maker.localeCompare(b.maker) || a.price - b.price);
    const strip = $('.cs-strip', this.el);
    strip.innerHTML = this.list.map(c => {
      const owned = Save.profile.cars.some(g => g.carId === c.id);
      return `<div class="hcard" style="width:260px;height:160px"><img src="${carThumb(c.id)}" style="position:absolute;inset:6px 20px 44px;width:calc(100% - 40px);height:calc(100% - 50px);object-fit:contain">
      <div class="nm" style="bottom:10px;font-size:20px">${c.name}</div>${this.mode === 'register' ? '<div class="lock" style="background:#ff7a00;color:#111;padding:2px 10px">おすすめ</div>' : owned ? '<div class="lock">所有中</div>' : `<div class="lock">¥${c.price.toLocaleString()}</div>`}<div class="edge"></div></div>`;
    }).join('');
    $('.cs-strip', this.el).style.display = 'flex'; $('.cs-menu', this.el).style.display = 'none';
    this.zone = 'list';
    this.focus = new Focus($$('.hcard', strip), { axis: 'h', index: this.lastIdx || 0, onChange: (i) => this.show(i), onSelect: (i) => this.openMenu(i) });
    this.show(this.focus.i);
    startTimer($('.timer', this.el), 60, () => this.zone === 'list' ? this.openMenu(this.focus.i) : this.menuFocus.select());
  },
  show(i) {
    const c = this.list[i]; this.lastIdx = i;
    const spec = buildSpec(c); const st = carStats(spec);
    App.showroom.setCar(spec, { paint: ['white', 'red', 'blue', 'yellow', 'silver', 'black'][i % 6] });
    $('.cs-maker', this.el).innerHTML = makerLogo(c.maker);
    $('.cs-left', this.el).innerHTML = `<div style="font-size:20px;color:#aaa;font-family:var(--font)">CATEGORY</div><div style="font-size:34px;color:var(--orange2)">${c.category} <span style="font-size:22px;color:#ddd">${c.catJp}</span></div><div style="margin-top:14px;color:#ddd">${esc(c.desc)}</div>`;
    $('.cs-info', this.el).innerHTML = `<div style="font-size:42px;font-style:italic;line-height:46px">${c.name}</div><div style="font-family:var(--jp);font-weight:900;font-size:20px;color:#666">${MAKERS[c.maker].name} · ${c.year}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-top:12px;font-size:22px">
        <span>駆動方式</span><b style="text-align:right;color:#c00">${c.drive}</b><span>最高出力</span><b style="text-align:right">${c.engine.hp} PS</b>
        <span>最大トルク</span><b style="text-align:right">${c.engine.torque} N·m</b><span>排気量</span><b style="text-align:right">${c.disp.toLocaleString()} cc</b>
        <span>車両重量</span><b style="text-align:right">${c.mass} kg</b><span>ミッション</span><b style="text-align:right">${c.gears.length}速 MT</b>
        <span>車両タイプ</span><b style="text-align:right">${c.body.style.toUpperCase()}</b><span>価格</span><b style="text-align:right;color:#c60">${this.mode === 'register' ? '無料' : '¥' + c.price.toLocaleString()}</b></div>`;
    $('.cs-stats', this.el).innerHTML = statBars(st) + `<div style="margin-top:10px;font-size:20px;color:#aaa">TOP SPEED <b style="color:#fff">${topSpeedKmh(spec)} km/h</b> · ENGINE <b style="color:#fff">${c.engine.type}</b></div>`;
  },
  openMenu(i) {
    Audio.ui('ok'); this.zone = 'menu';
    const m = $('.cs-menu', this.el); $('.cs-strip', this.el).style.display = 'none'; m.style.display = 'flex';
    $('.cs-hint', this.el).textContent = 'メニューを選んでください';
    m.innerHTML = `<button class="btn primary" style="height:120px;min-width:360px;font-size:40px;font-family:var(--jp);font-weight:900">🔑 使用登録</button><button class="btn blue" style="height:120px;min-width:340px;font-size:36px;font-family:var(--jp);font-weight:900">ドレスアップ</button><button class="btn dark" style="height:120px;min-width:300px;font-size:36px;font-family:var(--jp);font-weight:900">前に戻る</button>`;
    this.menuFocus = new Focus($$('.btn', m), { axis: 'h', onSelect: (k) => k === 0 ? this.register(false) : k === 1 ? this.register(true) : this.closeMenu() });
  },
  closeMenu() { Audio.ui('back'); this.zone = 'list'; $('.cs-menu', this.el).style.display = 'none'; $('.cs-strip', this.el).style.display = 'flex'; $('.cs-hint', this.el).textContent = 'クルマを選んでください(ドラッグで回転)'; },
  async register(thenDress) {
    const c = this.list[this.focus.i]; stopTimer();
    if (!Save.canAddCar()) { await dialog.alert('CAR ADD', `登録可能な車両は最大${MAX_GARAGE}台です`); return; }
    const price = this.mode === 'register' ? 0 : c.price;
    if (price > Save.profile.credits) { Audio.ui('error'); await dialog.alert('クレジット不足', `この車両の登録には ¥${price.toLocaleString()} 必要です。<br>(所持: ¥${Save.profile.credits.toLocaleString()})`); return this.restartTimer(); }
    const ok = await dialog.confirm('使用登録', `<b style="font-size:40px">${c.name}</b><br>この車両をガレージに登録しますか?${price ? `<br>価格: <b style="color:#ffd400">¥${price.toLocaleString()}</b>` : ''}<br><span style="font-size:22px;color:#aaa">登録台数 ${Save.profile.cars.length + 1} / ${MAX_GARAGE}</span>`, '登録する', 'やめる');
    if (!ok) return this.restartTimer();
    Save.profile.credits -= price;
    const gc = Save.addCar(c.id);
    Save.setActive(gc.uid);
    await Save.persistNow('car-add');
    Audio.ui('coin'); toast(`${c.name} を登録しました`);
    UI.go('dressup', { uid: gc.uid, flow: this.mode === 'register' ? 'register' : 'garage', skipToDone: !thenDress && this.mode === 'register' ? false : !thenDress });
  },
  restartTimer() { startTimer($('.timer', this.el), 60, () => this.zone === 'list' ? this.openMenu(this.focus.i) : this.menuFocus.select()); },
  onAction(a) {
    if (a === 'back') { if (this.zone === 'menu') return this.closeMenu(); if (this.mode === 'register') { Audio.ui('error'); toast('最初の1台を登録してください'); return; } Audio.ui('back'); return UI.go('garage'); }
    (this.zone === 'menu' ? this.menuFocus : this.focus).action(a);
  },
});

// ───────────────────────── DRESS UP ─────────────────────────
const DRESS_CATS = [
  { k: 'paint', label: 'BODY COLOR', jp: 'ボディカラー', list: PAINTS.map(p => ({ id: p.id, name: p.name, price: p.id === 'panda' ? 1500 : 0, sw: p.hex })) },
  { k: 'wheel', label: 'WHEELS', jp: 'ホイール', list: WHEELS.map(w => ({ id: w.id, name: w.name, price: w.price, sw: w.color })) },
  { k: 'aero', label: 'AERO', jp: 'エアロ', list: AEROS },
  { k: 'spoiler', label: 'WING', jp: 'ウイング', list: SPOILERS },
  { k: 'decal', label: 'DECAL', jp: 'ステッカー', list: DECALS },
  { k: 'height', label: 'HEIGHT', jp: '車高', list: RIDE_HEIGHTS.map(h => ({ id: h.id, name: h.name, price: h.id * 800 })) },
  { k: 'muffler', label: 'MUFFLER', jp: 'マフラー', list: MUFFLERS },
];
UI.register({
  id: 'dressup',
  build(n) {
    n.innerHTML = `<div class="rotzone" style="position:absolute;left:720px;right:0;top:150px;bottom:100px"></div>
      <div class="topbar" style="padding-left:60px"><div class="title">DRESS UP</div><div class="jp">ドレスアップ</div><div class="right"><span class="credits"></span></div></div>
      <div class="gtabs"></div><div class="gpanel"><div class="glist"></div></div>
      <div class="gstats du-sum" style="bottom:190px"></div>
      <div style="position:absolute;right:60px;bottom:96px;display:flex;gap:16px" class="du-btns"><button class="btn primary">確定して保存</button><button class="btn dark">キャンセル</button></div>
      ${footer([['←→', 'カテゴリ'], ['↑↓', 'パーツ'], ['ENTER', '装着'], ['ESC', '戻る']])}`;
  },
  enter(params = {}) {
    this.params = params;
    const gc = Save.profile.cars.find(c => c.uid === params.uid) || Save.activeCar; this.gc = gc;
    if (params.skipToDone) return this.done(true);
    this.orig = JSON.parse(JSON.stringify(gc.dress));
    this.draft = JSON.parse(JSON.stringify(gc.dress));
    gc.owned ||= {};
    this.spec = App.specOf(gc);
    App.gfx.setView(App.showroom); App.showroom.frameFor(-1.6); App.showroom.setCar(this.spec, this.draft);
    this.cat = 0; this.zone = 'list';
    const tabs = $('.gtabs', this.el);
    tabs.innerHTML = DRESS_CATS.map(c => `<div class="gtab" style="font-size:20px;padding:10px 20px">${c.jp}</div>`).join('');
    $$('.gtab', tabs).forEach((t, k) => t.onclick = () => { this.cat = k; Audio.ui('move'); this.renderList(); });
    const btns = $$('.du-btns .btn', this.el);
    btns[0].onclick = () => this.confirm(); btns[1].onclick = () => this.cancel();
    this.renderList();
  },
  leave() { App.showroom.frameFor(0); },
  cost() {
    let total = 0; const owned = this.gc.owned;
    for (const c of DRESS_CATS) { const v = this.draft[c.k]; const it = c.list.find(x => x.id === v); if (it && it.price && v !== this.orig[c.k] && !(owned[c.k] || []).includes(v)) total += it.price; }
    return total;
  },
  renderList() {
    $$('.gtab', this.el).forEach((t, k) => t.classList.toggle('on', k === this.cat));
    const c = DRESS_CATS[this.cat]; const owned = this.gc.owned[c.k] || [];
    $('.glist', this.el).innerHTML = c.list.map(it => `<div class="gitem ${this.draft[c.k] === it.id ? 'sel' : ''}">${it.sw ? `<span class="sw" style="background:${it.sw}"></span>` : ''}${esc(it.name)}<span class="p ${!it.price || owned.includes(it.id) || this.orig[c.k] === it.id ? 'own' : ''}">${!it.price ? 'FREE' : owned.includes(it.id) || this.orig[c.k] === it.id ? '所有' : '¥' + it.price.toLocaleString()}</span></div>`).join('');
    const items = $$('.gitem', this.el);
    const cur = Math.max(0, c.list.findIndex(it => it.id === this.draft[c.k]));
    this.focus = new Focus(items, { axis: 'v', index: cur, onChange: (i) => this.apply(c.list[i].id), onSelect: (i) => { this.apply(c.list[i].id); Audio.ui('ok'); } });
    this.sum();
  },
  apply(id) {
    const c = DRESS_CATS[this.cat];
    if (this.draft[c.k] === id) return;
    this.draft[c.k] = id; App.showroom.setCar(this.spec, this.draft);
    $$('.gitem', this.el).forEach((n, k) => n.classList.toggle('sel', c.list[k].id === id));
    if (c.k === 'muffler' && Audio.ctx) { const m = MUFFLERS.find(x => x.id === id); const e = Audio.createEngine(this.spec, { muffler: m.loud }); if (e) { const v = { rpm: 3000, limiterHit: 0, boost: 0, slipRear: 0, slipFront: 0, speed: 0 }; let t = 0; const h = setInterval(() => { t += 0.05; v.rpm = 2500 + Math.sin(t * 3) ** 2 * 5000; e.update(v, 1); if (t > 1.2) { clearInterval(h); e.stop(); } }, 50); } }
    this.sum();
  },
  sum() {
    $('.credits', this.el).textContent = '¥' + Save.profile.credits.toLocaleString();
    const cost = this.cost();
    $('.du-sum', this.el).innerHTML = `<div style="font-size:34px;font-style:italic">${esc(this.gc.name)}</div>
      <div style="font-family:var(--jp);font-weight:900;font-size:22px;color:#aaa;margin:6px 0 12px">変更内容は3Dモデルにリアルタイムで反映されます</div>
      <div style="display:flex;justify-content:space-between;font-size:28px;font-style:italic"><span>合計</span><span style="color:${cost > Save.profile.credits ? '#ff4a4a' : '#ffd400'}">¥${cost.toLocaleString()}</span></div>`;
    this.el.style.setProperty('--x', 0);
  },
  async confirm() {
    const cost = this.cost();
    if (cost > Save.profile.credits) { Audio.ui('error'); return dialog.alert('クレジット不足', `必要: ¥${cost.toLocaleString()} / 所持: ¥${Save.profile.credits.toLocaleString()}`); }
    if (cost > 0 && !(await dialog.confirm('ドレスアップ確定', `¥${cost.toLocaleString()} を支払って変更を確定しますか?`, '確定', 'やめる'))) return;
    Save.profile.credits -= cost;
    for (const c of DRESS_CATS) { const v = this.draft[c.k]; (this.gc.owned[c.k] ||= []); if (!this.gc.owned[c.k].includes(v)) this.gc.owned[c.k].push(v); }
    this.gc.dress = this.draft; Save.touch('dressup'); await Save.persistNow('dressup');
    Audio.ui('coin'); toast('ドレスアップを保存しました');
    this.done(false);
  },
  async cancel() {
    if (JSON.stringify(this.draft) !== JSON.stringify(this.orig) && !(await dialog.confirm('変更を破棄', '変更内容を破棄して戻りますか?', '破棄する', 'やめる'))) return;
    Audio.ui('back'); this.done(false);
  },
  async done(skipped) {
    if (this.params.flow === 'register') {
      App.gfx.setView(App.showroom); App.showroom.frameFor(0); App.showroom.setCar(App.specOf(this.gc), this.gc.dress);
      await dialog.show({ title: '使用車両登録完了', text: `<b style="font-size:44px">${esc(this.gc.name)}</b><br>ガレージに登録されました!<br>さあ、峠へ向かおう。`, buttons: [{ label: 'メインメニューへ', value: true, cls: 'primary' }] });
      UI.go('mode'); return;
    }
    UI.go(this.params.flow === 'garage' ? 'garage' : 'mode');
  },
  onAction(a) {
    if (a === 'back') return this.cancel();
    if (a === 'left' || a === 'right') { this.cat = (this.cat + (a === 'left' ? -1 : 1) + DRESS_CATS.length) % DRESS_CATS.length; Audio.ui('move'); return this.renderList(); }
    if (a === 'ok' && this.focus) { Audio.ui('ok'); return; }
    this.focus && this.focus.action(a);
  },
});

// ───────────────────────── GARAGE ─────────────────────────
UI.register({
  id: 'garage',
  build(n) {
    n.innerHTML = `<div class="rotzone" style="position:absolute;left:720px;right:0;top:150px;bottom:340px"></div>
      <div class="topbar" style="padding-left:60px"><div class="title">GARAGE</div><div class="jp">ガレージ</div><div class="right"><span class="credits"></span></div></div>
      <div class="gpanel" style="top:150px"><div class="glist"></div></div>
      <div class="gstats g-st" style="bottom:240px"></div>
      <div class="g-acts" style="position:absolute;right:60px;bottom:110px;display:flex;gap:14px"></div>
      ${footer([['↑↓', '車両'], ['←→', 'メニュー'], ['ENTER', '決定'], ['ESC', '戻る']])}`;
  },
  enter() {
    App.gfx.setView(App.showroom); App.showroom.frameFor(-1.6);
    this.render(Math.max(0, Save.profile.cars.findIndex(c => c.uid === Save.profile.activeCar)));
  },
  leave() { App.showroom.frameFor(0); },
  render(idx = 0) {
    const p = Save.profile;
    $('.credits', this.el).textContent = '¥' + p.credits.toLocaleString();
    const slots = [];
    for (let i = 0; i < MAX_GARAGE; i++) slots.push(p.cars[i] || null);
    $('.glist', this.el).innerHTML = slots.map((c, i) => c
      ? `<div class="gitem ${c.uid === p.activeCar ? 'sel' : ''}" style="height:118px"><img src="${carThumb(c.carId, c.dress)}" style="width:170px;height:96px;object-fit:contain;margin-right:16px"><div><div>${esc(c.name)}</div><div style="font-size:18px;color:#aaa">${c.drive} · ${App.specOf(c).engine.hp}PS · ${tuneLevel(c)}</div></div><span class="p own">${c.uid === p.activeCar ? '使用中' : ''}</span></div>`
      : `<div class="gitem" style="height:118px;color:#777;justify-content:center">— EMPTY SLOT ${i + 1} —  <span style="margin-left:20px;color:#ffd400">＋ CAR ADD</span></div>`).join('');
    this.slots = slots;
    this.focus = new Focus($$('.gitem', this.el), { axis: 'v', index: idx, onChange: (i) => this.show(i), onSelect: (i) => { if (!this.slots[i]) this.addCar(); else this.act(0); } });
    this.show(this.focus.i);
  },
  show(i) {
    const c = this.slots[i]; const acts = $('.g-acts', this.el);
    if (!c) {
      $('.g-st', this.el).innerHTML = `<div style="font-family:var(--jp);font-weight:900;font-size:26px">空き枠です。新しい車両を登録できます。<br><span style="color:#aaa;font-size:20px">登録台数 ${Save.profile.cars.length} / ${MAX_GARAGE}</span></div>`;
      acts.innerHTML = `<button class="btn primary" data-k="add">＋ CAR ADD</button><button class="btn dark" data-k="back">戻る</button>`;
    } else {
      const spec = App.specOf(c); App.showroom.setCar(spec, c.dress);
      $('.g-st', this.el).innerHTML = `<div style="font-size:30px;font-style:italic">${esc(c.name)} <span style="font-size:20px;color:#ffd400">${tuneLevel(c)}</span></div>${statBars(carStats(spec))}<div style="margin-top:8px;font-size:18px;color:#aaa">登録日 ${new Date(c.registeredAt).toLocaleDateString('ja-JP')} · ${spec.engine.hp}PS / ${spec.mass}kg</div>`;
      acts.innerHTML = `<button class="btn primary small" data-k="use">使用する</button><button class="btn blue small" data-k="dress">ドレスアップ</button><button class="btn blue small" data-k="tune">チューニング</button><button class="btn dark small" data-k="del">削除</button><button class="btn dark small" data-k="add">CAR ADD</button><button class="btn dark small" data-k="back">戻る</button>`;
    }
    this.actFocus = new Focus($$('.btn', acts), { axis: 'h', sound: true, onSelect: (k, b) => this.run(b.dataset.k) });
    this.actFocus.items.forEach(b => b.classList.remove('focus'));
  },
  act(k) { this.run(this.actFocus.items[k].dataset.k); },
  async run(k) {
    const c = this.slots[this.focus.i];
    if (k === 'back') { Audio.ui('back'); return UI.go('mode'); }
    if (k === 'add') return this.addCar();
    if (!c) return;
    if (k === 'use') { Save.setActive(c.uid); Audio.ui('ok'); toast(`${c.name} を使用車両に設定しました`); return this.render(this.focus.i); }
    if (k === 'dress') { Audio.ui('ok'); return UI.go('dressup', { uid: c.uid, flow: 'garage' }); }
    if (k === 'tune') { Audio.ui('ok'); return UI.go('tuning', { uid: c.uid }); }
    if (k === 'del') {
      if (Save.profile.cars.length <= 1) { Audio.ui('error'); return dialog.alert('削除できません', '最低1台の車両が必要です。'); }
      const ok = await dialog.confirm('車両の削除', `<b>${esc(c.name)}</b>(${tuneLevel(c)})を削除しますか?<br><span style="color:#ff6a6a">チューニング・ドレスアップも失われます。元に戻せません。</span>`, '削除する', 'やめる');
      if (!ok) return;
      Save.removeCar(c.uid); await Save.persistNow('car-remove'); toast('車両を削除しました'); this.render(0);
    }
  },
  async addCar() {
    if (!Save.canAddCar()) { Audio.ui('error'); return dialog.alert('CAR ADD', `登録可能な車両は最大${MAX_GARAGE}台です。`); }
    Audio.ui('ok'); UI.go('carselect', { mode: 'add' });
  },
  onAction(a) {
    if (a === 'back') { Audio.ui('back'); return UI.go('mode'); }
    if (a === 'left' || a === 'right') { if (!this.actFocus.items.some(b => b.classList.contains('focus'))) { this.actFocus.apply(); Audio.ui('move'); return; } return this.actFocus.action(a); }
    if (a === 'ok') { if (this.actFocus.items.some(b => b.classList.contains('focus'))) return this.actFocus.select(); return this.focus.select(); }
    if (a === 'up' || a === 'down') { this.focus.action(a); }
  },
});

// ───────────────────────── TUNING ─────────────────────────
UI.register({
  id: 'tuning',
  build(n) {
    n.innerHTML = `<div class="rotzone" style="position:absolute;left:720px;right:0;top:150px;bottom:340px"></div>
      <div class="topbar" style="padding-left:60px"><div class="title">TUNING</div><div class="jp">チューニング</div><div class="right"><span class="credits"></span></div></div>
      <div class="gpanel"><div class="glist"></div></div><div class="gstats t-st" style="bottom:110px"></div>
      ${footer([['↑↓', 'パーツ'], ['ENTER', '購入'], ['ESC', '戻る']])}`;
  },
  enter(params) {
    this.gc = Save.profile.cars.find(c => c.uid === params.uid) || Save.activeCar; this.gc.tune ||= {};
    App.gfx.setView(App.showroom); App.showroom.frameFor(-1.6); App.showroom.setCar(App.specOf(this.gc), this.gc.dress);
    this.render(0);
  },
  leave() { App.showroom.frameFor(0); },
  render(idx) {
    const keys = Object.keys(TUNE_PARTS); const t = this.gc.tune;
    $('.credits', this.el).textContent = '¥' + Save.profile.credits.toLocaleString();
    $('.glist', this.el).innerHTML = keys.map(k => { const lv = t[k] || 0; const part = TUNE_PARTS[k]; return `<div class="gitem">${part.jp}<div class="tune-lv">${[1, 2, 3].map(i => `<i class="${lv >= i ? 'on' : ''}"></i>`).join('')}</div><span class="p ${lv >= 3 ? 'own' : ''}">${lv >= 3 ? 'MAX' : 'STAGE ' + (lv + 1) + ' ¥' + part.cost[lv + 1].toLocaleString()}</span></div>`; }).join('');
    this.focus = new Focus($$('.gitem', this.el), { axis: 'v', index: idx, onChange: (i) => this.preview(keys[i]), onSelect: (i) => this.buy(keys[i]) });
    this.preview(keys[this.focus.i]);
  },
  preview(k) {
    const cur = App.specOf(this.gc); const t2 = { ...this.gc.tune, [k]: Math.min(3, (this.gc.tune[k] || 0) + 1) };
    const nxt = buildSpec(carById(this.gc.carId), t2, this.gc.setup);
    $('.t-st', this.el).innerHTML = `<div style="font-size:30px;font-style:italic">${esc(this.gc.name)} <span style="font-size:20px;color:#ffd400">${tuneLevel(this.gc)}</span></div>${statBars(carStats(cur), carStats(nxt))}
      <div style="margin-top:10px;font-size:20px;color:#ccc">${cur.engine.hp}PS → <b style="color:#3dff8a">${nxt.engine.hp}PS</b> · ${cur.mass}kg → <b style="color:#3dff8a">${nxt.mass}kg</b> · GRIP ${(cur.tire.grip).toFixed(2)} → <b style="color:#3dff8a">${nxt.tire.grip.toFixed(2)}</b></div>`;
  },
  async buy(k) {
    const lv = this.gc.tune[k] || 0; if (lv >= 3) { Audio.ui('error'); return; }
    const cost = TUNE_PARTS[k].cost[lv + 1];
    if (cost > Save.profile.credits) { Audio.ui('error'); return dialog.alert('クレジット不足', `必要: ¥${cost.toLocaleString()}`); }
    if (!(await dialog.confirm('チューニング', `${TUNE_PARTS[k].jp} STAGE ${lv + 1} を ¥${cost.toLocaleString()} で購入しますか?`, '購入', 'やめる'))) return;
    Save.profile.credits -= cost; this.gc.tune[k] = lv + 1; await Save.persistNow('tune'); Audio.ui('coin');
    this.render(this.focus.i);
  },
  onAction(a) { if (a === 'back') { Audio.ui('back'); return UI.go('garage'); } this.focus.action(a); },
});

// ───────────────────────── COURSE SELECT ─────────────────────────
const CPU_LV = [{ id: 'easy', name: 'EASY', skill: 0.82, aggr: 0.2, reward: 400 }, { id: 'normal', name: 'NORMAL', skill: 0.9, aggr: 0.45, reward: 700 }, { id: 'hard', name: 'HARD', skill: 0.97, aggr: 0.75, reward: 1100 }, { id: 'legend', name: 'LEGEND', skill: 1.02, aggr: 1.0, reward: 1600 }];
UI.register({
  id: 'course',
  build(n) {
    n.innerHTML = `<div class="cs-bg" style="position:absolute;inset:0"></div><div class="pp"></div>
      <div class="topbar" style="padding-left:700px;background:none;border:none"><div class="title">COURSE SELECT</div><div class="jp cs-mode"></div></div><div class="timer"><small>TIME</small><b>60</b></div>
      <div class="c-car" style="position:absolute;left:30px;top:180px;width:560px;padding:18px 24px;background:linear-gradient(90deg,rgba(180,0,200,.35),rgba(30,0,40,.6));border:3px solid #d040ff;box-shadow:0 0 20px rgba(200,60,255,.5)"></div>
      <canvas class="c-map" width="760" height="520" style="position:absolute;left:600px;top:160px;width:760px;height:520px"></canvas>
      <div class="c-name" style="position:absolute;left:620px;top:640px;font-style:italic"></div>
      <div class="c-info" style="position:absolute;right:30px;top:180px;width:520px;padding:20px 26px;background:linear-gradient(180deg,rgba(20,40,90,.85),rgba(5,10,25,.85));border:2px solid #4a6aaa;font-family:var(--jp);font-weight:900;font-size:22px;line-height:36px"></div>
      <div class="opt-row c-opts" style="top:auto;bottom:356px;right:30px;width:520px"></div>
      <div class="hlist c-list" style="bottom:96px"></div>
      ${footer([['←→', 'コース'], ['↑↓', 'オプション'], ['ENTER', '決定'], ['ESC', '戻る']])}`;
  },
  enter() {
    App.gfx.setView(null);
    const P = App.pending; this.p = P;
    $('.pp', this.el).innerHTML = playerPlate();
    $('.cs-mode', this.el).textContent = P.event ? 'SPECIAL EVENT' : P.mode === 'battle' ? 'COURSE BATTLE' : 'TIME TRIAL';
    this.tracks = {};
    const list = $('.c-list', this.el);
    list.innerHTML = COURSES.map(c => { const locked = !Save.profile.unlocked.courses.includes(c.id); return `<div class="hcard"><canvas width="460" height="280"></canvas><div class="nm">${c.jp}</div><div class="sb">${c.sub} · ${c.category}</div>${locked ? '<div class="lock">🔒 LOCKED</div>' : ''}<div class="edge"></div></div>`; }).join('');
    $$('.hcard canvas', list).forEach((cv, k) => drawCourseMap(cv, this.track(COURSES[k].id, 'fwd'), { w: 6 }));
    const idx = Math.max(0, COURSES.findIndex(c => c.id === P.courseId));
    this.zone = 'list'; this.optI = 0;
    this.focus = new Focus($$('.hcard', list), { axis: 'h', index: idx, onChange: (i) => { P.courseId = COURSES[i].id; P.dir = 'fwd'; P.weather = null; this.show(); }, onSelect: () => this.go() });
    P.courseId = COURSES[idx].id; P.cpu ||= 'normal';
    this.show();
    startTimer($('.timer', this.el), 60, () => this.go(true));
  },
  track(id, dir) { const k = id + dir; return this.tracks[k] ||= new Track(courseById(id), dir); },
  show() {
    const P = this.p; const c = courseById(P.courseId); const tr = this.track(c.id, P.dir);
    const weather = P.weather || c.weather;
    $('.cs-bg', this.el).style.background = `linear-gradient(115deg, rgba(0,0,0,.85) 0%, rgba(0,0,0,.4) 50%, rgba(0,0,0,.85) 100%), ${c.time === 'dusk' ? 'linear-gradient(180deg,#3a1a40,#a04a3a 60%,#1a0c14)' : 'linear-gradient(180deg,#02040b,#0a1838 60%,#05070c)'}`;
    drawCourseMap($('.c-map', this.el), tr, { w: 7, color: '#ff4af0', glow: 'rgba(255,60,230,.45)' });
    const rec = Save.profile.records[`${c.id}:${P.dir}`];
    $('.c-name', this.el).innerHTML = `<div style="font-size:70px;line-height:70px;text-shadow:0 5px 0 #000">${c.name}</div><div style="font-family:var(--jp);font-weight:900;font-size:30px;color:#ffd400">${c.jp} — ${c.dirs[P.dir][1]}</div>`;
    const locked = !Save.profile.unlocked.courses.includes(c.id);
    $('.c-info', this.el).innerHTML = `<div style="color:#9cf;font-size:20px">COURSE INFO</div>${esc(c.desc)}
      <div style="margin-top:10px;display:grid;grid-template-columns:150px 1fr;gap:2px 10px">
      <span style="color:#9ab">走行方向</span><span>${c.dirs[P.dir][1]}(${c.dirs[P.dir][0]})</span>
      <span style="color:#9ab">全長</span><span>${(tr.length * (tr.closed ? c.laps : 1) / 1000).toFixed(2)} km${tr.closed ? ` (${c.laps}周)` : ''}</span>
      <span style="color:#9ab">高低差</span><span>${Math.round(tr.bounds.maxY - tr.bounds.minY)} m</span>
      <span style="color:#9ab">路面</span><span style="color:${weather === 'rain' ? '#6ac8ff' : '#fff'}">${weather === 'rain' ? 'WET(雨)' : 'DRY'}</span>
      <span style="color:#9ab">時間帯</span><span>${c.time === 'night' ? '夜' : c.time === 'dusk' ? '夕暮れ' : '昼'}</span>
      <span style="color:#9ab">難易度</span><span style="color:#ffd400">${'★'.repeat(c.difficulty)}${'☆'.repeat(5 - c.difficulty)}</span>
      <span style="color:#9ab">特徴</span><span>${c.features.join(' / ')}</span>
      <span style="color:#9ab">ベスト</span><span style="color:#3dff8a">${rec ? fmt(rec.best) : '記録なし'}</span>
      <span style="color:#9ab">解放条件</span><span style="color:${locked ? '#ff6a6a' : '#3dff8a'}">${c.unlock ? (locked ? c.unlock.text : '解放済み') : '最初から解放'}</span></div>`;
    // current car panel
    const gc = Save.activeCar; const spec = App.specOf(gc);
    $('.c-car', this.el).innerHTML = `<div style="display:flex;gap:16px;align-items:center"><img src="${carThumb(gc.carId, gc.dress)}" style="width:200px;height:112px;object-fit:contain;background:#000a;border:2px solid #fff3"><div><div style="font-size:30px;font-style:italic">${esc(gc.name)}</div><div style="font-size:18px;color:#ddd">${gc.drive} · ${spec.engine.hp}PS · ${spec.mass}kg</div><div style="font-size:18px;color:#ffd400">${tuneLevel(gc)}</div></div></div>${statBars(carStats(spec))}
      <div style="margin-top:8px;font-family:var(--jp);font-weight:900;font-size:18px;color:#ccc">※ 車両の変更はガレージで行えます</div>`;
    // options
    const opts = [['DIRECTION', c.dirs[P.dir][0] + ' ' + c.dirs[P.dir][1]], ['WEATHER', weather === 'rain' ? 'RAIN 雨' : 'CLEAR 晴']];
    if (P.mode === 'battle') opts.push(['CPU LEVEL', CPU_LV.find(l => l.id === P.cpu).name]);
    if (P.event) opts.length = 0;
    $('.c-opts', this.el).innerHTML = opts.map(([l, v]) => `<div class="opt"><label>${l}</label><span class="arr">◀</span><span class="val">${v}</span><span class="arr">▶</span></div>`).join('');
    $$('.c-opts .opt', this.el).forEach((o, k) => { o.onclick = (e) => { this.optI = k; this.zone = 'opt'; this.changeOpt(e.offsetX < o.clientWidth / 2 ? -1 : 1); }; });
    this.hlOpt();
  },
  hlOpt() { $$('.c-opts .opt', this.el).forEach((o, k) => o.classList.toggle('focus', this.zone === 'opt' && k === this.optI)); },
  changeOpt(d) {
    const P = this.p; const c = courseById(P.courseId);
    if (this.optI === 0) P.dir = P.dir === 'fwd' ? 'rev' : 'fwd';
    else if (this.optI === 1) P.weather = (P.weather || c.weather) === 'rain' ? 'clear' : 'rain';
    else { const i = CPU_LV.findIndex(l => l.id === P.cpu); P.cpu = CPU_LV[(i + d + CPU_LV.length) % CPU_LV.length].id; }
    Audio.ui('move'); this.show();
  },
  async go(timeout) {
    const P = this.p; const c = courseById(P.courseId);
    if (!Save.profile.unlocked.courses.includes(c.id)) { Audio.ui('error'); if (!timeout) await dialog.alert('LOCKED', `${c.jp} は未解放です。<br>${c.unlock.text}`); else { P.courseId = COURSES[0].id; } if (!timeout) return startTimer($('.timer', this.el), 60, () => this.go(true)); }
    stopTimer(); Audio.ui('start');
    const lv = CPU_LV.find(l => l.id === P.cpu);
    UI.go('race', { mode: P.mode, courseId: P.courseId, dir: P.dir, weather: P.weather || c.weather, cpu: lv, event: P.event });
  },
  onAction(a) {
    if (a === 'back') { Audio.ui('back'); return UI.go(this.p.event ? 'special' : 'mode'); }
    const nOpt = $$('.c-opts .opt', this.el).length;
    if (a === 'up' && nOpt) { if (this.zone === 'list') { this.zone = 'opt'; this.optI = nOpt - 1; } else this.optI = Math.max(0, this.optI - 1); Audio.ui('move'); return this.hlOpt(); }
    if (a === 'down' && this.zone === 'opt') { if (this.optI < nOpt - 1) this.optI++; else this.zone = 'list'; Audio.ui('move'); return this.hlOpt(); }
    if (this.zone === 'opt' && (a === 'left' || a === 'right')) return this.changeOpt(a === 'left' ? -1 : 1);
    if (a === 'ok') return this.go();
    if (this.p.event) return; // course fixed for events
    this.focus.action(a);
  },
});

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
  build(n) { n.innerHTML = `<div class="bg-metal"></div>${head('SETTINGS', '設定', false)}<div class="opt-row s-opts" style="left:420px;right:420px;width:auto;top:200px"></div>
    <div style="position:absolute;left:420px;right:420px;bottom:110px;font-family:var(--jp);font-weight:900;font-size:22px;line-height:36px;color:#bbb;background:rgba(0,0,0,.5);padding:16px 24px;border-left:4px solid var(--orange)">
    操作:←→ ステアリング / ↑ アクセル / ↓ ブレーキ・バック / SPACE サイドブレーキ / E・Q シフトアップ・ダウン(MT) / C カメラ切替 / R コース復帰 / ESC ポーズ<br>ゲームパッド:左スティック ステア / RT アクセル / LT ブレーキ / A サイドブレーキ / RB・LB シフト</div>
    ${footer([['↑↓', '項目'], ['←→', '変更'], ['ESC', '戻る']])}`; },
  enter(params = {}) {
    App.gfx.setView(null); this.back = params.back || 'mode'; this.i = 0; this.render();
  },
  rows() {
    const s = App.settings;
    return [
      ['BGM VOLUME', 'slider', 'bgm'], ['SE VOLUME', 'slider', 'sfx'],
      ['TRANSMISSION', s.autoGear ? 'AT オートマ' : 'MT マニュアル', 'autoGear'],
      ['DRIFT ASSIST', 'slider', 'assist'],
      ['CAMERA', ['CHASE', 'FAR', 'BUMPER'][s.camera], 'camera'],
      ['TOUCH CONTROLS', { auto: 'AUTO', on: 'ON', off: 'OFF' }[s.touch], 'touch'],
    ];
  },
  render() {
    const s = App.settings;
    $('.s-opts', this.el).innerHTML = this.rows().map(([l, v, k]) => `<div class="opt"><label>${l}</label><span class="arr">◀</span>${v === 'slider' ? `<span class="slider">${Array.from({ length: 10 }, (_, i) => `<i class="${i < s[k] ? 'on' : ''}"></i>`).join('')}</span>` : `<span class="val">${v}</span>`}<span class="arr">▶</span></div>`).join('') + `<div class="opt" style="justify-content:center"><span class="val">◀ 戻る</span></div>`;
    $$('.s-opts .opt', this.el).forEach((o, k) => { o.classList.toggle('focus', k === this.i); o.onclick = (e) => { this.i = k; if (k === this.rows().length) return this.exit(); this.change(e.offsetX < o.clientWidth / 2 ? -1 : 1); }; });
  },
  change(d) {
    const s = App.settings; const k = this.rows()[this.i]?.[2]; if (!k) return;
    if (k === 'bgm' || k === 'sfx' || k === 'assist') s[k] = Math.max(0, Math.min(10, s[k] + d));
    if (k === 'autoGear') s.autoGear = !s.autoGear;
    if (k === 'camera') s.camera = (s.camera + d + 3) % 3;
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
    if (a === 'back') { Audio.ui('back'); return UI.go('mode'); }
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
      try { await Net.deleteAccount(pw); Save.profile = null; Save.setGuest(); await dialog.alert('削除完了', 'アカウントを削除しました。'); UI.go('title'); }
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
  onAction(a) { if (a === 'back') { Audio.ui('back'); return UI.go('mode'); } this.focus.action(a); },
});
