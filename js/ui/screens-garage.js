// Reference-style screens: MODE SELECT, CAR SELECT, GARAGE, DRESS UP, WHEEL, METER, TUNING, COURSE SELECT
import { UI, Focus, $, $$, el, esc, dialog, toast, sleep, startTimer, stopTimer, rankBadge, avatarSVG } from './core.js';
import { backdrop, plate, consoleBox, logoMark, keyGuide, titleTimer, carIcon, brandMark } from './frame.js';
import { carThumb, tuneLevel, EVENTS } from './screens-menu.js';
import { App } from '../app.js';
import { Audio } from '../audio/audio.js';
import { Save, rankOf } from '../core/save.js';
import * as Net from '../net/firebase.js';
import { CARS, MAKERS, carById, buildSpec, carStats, topSpeedKmh, MAX_GARAGE, RIDE_HEIGHTS } from '../data/cars.js';
import { partPrice, TIRE_WIDTHS, AERO, PART_BRANDS, isCompatible, FINISHES, PALETTE, VINYL_SLOTS, VINYL_NAMES, WHEEL_BRANDS, WHEEL_DESIGNS, WHEEL_COLORS, WHEEL_SIZES, WHEEL_OFFSETS, TIRE_LOOKS, METERS, METER_BGS, METER_TEXT, METER_LIGHT, TUNE_CATS, TUNE_PARTS_V2, TUNE_MAX, tuneCost, tuneTotal, tuneStyle, normalizeCar } from '../data/custom.js';
import { COURSES, courseById } from '../data/courses.js';
import { Track } from '../world/track.js';
import { drawCourseMap, fmt } from '../game/hud.js';
import { drawMeter, demoState } from '../game/meters.js';
import { CoursePreview } from '../game/gfx.js';

// ---- helpers --------------------------------------------------------------------
const DRV_COL = { FR: '#d01020', FF: '#1a7ad0', '4WD': '#2a9a3a' };
const TIME_LBL = { night: '夜 (NIGHT)', dusk: '夕方 (DUSK)', day: '昼 (DAY)' };
const attrChips = (c) => `<span class="chip2" style="background:${DRV_COL[c.drive]}">${c.drive}</span><span class="chip2" style="background:#7a1aa0">${c.category}</span><span class="chip2" style="background:#e07a00">${c.engine.type}</span>`;
function segBars(rows, cur, next) {
  return `<div class="mbar">${rows.map(([l, k]) => { const a = Math.round(cur[k]), b = next ? Math.round(next[k]) : a; return `<span>${l}</span><div class="segs">${Array.from({ length: 10 }, (_, i) => `<i class="${i < a ? 'on' : i < b ? 'up' : ''}"></i>`).join('')}</div>`; }).join('')}</div>`;
}
const STAT6 = [['POWER', 'power'], ['HANDLING', 'handling'], ['ACCELERATION', 'accel'], ['BRAKING', 'brake'], ['STABILITY', 'stability'], ['GRIP', 'grip']];

// m:ss customise clock (3:00 default, can be disabled in SETTINGS)
let clockH = null;
function startClock(node, secs, onZero) {
  stopClock(); if (!node) return;
  if (!App.settings.custTimer) { node.classList.add('off'); node.querySelector('b').textContent = 'NO TIME LIMIT'; return; }
  node.classList.remove('off', 'warn'); let left = secs;
  const draw = () => { node.querySelector('b').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; node.classList.toggle('warn', left <= 15); };
  draw();
  clockH = setInterval(() => { left--; draw(); if (left <= 10 && left > 0) Audio.blip(660, 0.04, 'square', 0.05); if (left <= 0) { stopClock(); onZero && onZero(); } }, 1000);
}
function stopClock() { clearInterval(clockH); clockH = null; }
// arcade countdown (big number top-right)
function bigTimer(node, secs, onZero) {
  if (!App.settings.custTimer) { node.classList.add('off'); return stopTimer(); }
  node.classList.remove('off');
  startTimer(node, secs, onZero);
}

// vertical category carousel (center = selected)
function renderVcat(box, cats, sel, onPick) {
  box.innerHTML = cats.map((c, i) => `<div class="tile" data-i="${i}"><div class="ic">${carIcon(c.icon, c.band)}</div><div class="band" style="background:${c.band}">${esc(c.jp)}</div></div>`).join('') + '<i class="arrow up"></i><i class="arrow dn"></i>';
  const tiles = $$('.tile', box);
  const layout = (k) => tiles.forEach((t, i) => {
    const n = tiles.length; let d = i - k; if (d > n / 2) d -= n; if (d < -n / 2) d += n; const vis = Math.abs(d) <= 2;
    t.style.display = vis ? '' : 'none';
    t.style.top = (250 + d * 172) + 'px';
    t.classList.toggle('sel', d === 0); t.classList.toggle('far', Math.abs(d) === 2);
    t.style.zIndex = 10 - Math.abs(d);
  });
  tiles.forEach((t, i) => t.onclick = () => onPick(i));
  layout(sel);
  return layout;
}
// horizontal parts row
function renderRow(row, items, sel, equipped, onPick) {
  row.innerHTML = items.map((it, i) => `<div class="ptile" data-i="${i}">${it.html}${i === equipped ? '<div class="eq">装着中</div>' : ''}${it.locked ? `<div class="lk">${esc(it.locked)}</div>` : ''}</div>`).join('');
  const tiles = $$('.ptile', row);
  tiles.forEach((t, i) => t.onclick = () => onPick(i, true));
  const mark = () => { row.querySelector('.mk')?.remove(); tiles.forEach((t, i) => t.classList.toggle('sel', i === sel.i)); const m = document.createElement('i'); m.className = 'mk'; if (tiles[sel.i] && tiles[sel.i].nextSibling) row.insertBefore(m, tiles[sel.i].nextSibling); };
  // scroll so the selected tile is visible
  const scroll = () => { const off = Math.max(0, sel.i - 2) * 324; row.style.transform = `translateX(${-off}px)`; };
  row.style.transition = 'transform .2s';
  mark(); scroll();
  return () => { mark(); scroll(); };
}

// ───────────────────────── MODE SELECT ─────────────────────────
const MODES = [
  { id: 'trial', name: 'TIME TRIAL', sub: 'Time Trial', jp: 'タイムトライアル', desc: 'ひとりでコースを全開走行。自己ベストとゴーストに挑み、セクションタイムを削り取れ!', reward: 'クレジット / TP / 新記録ボーナス', grad: ['#2a6ad0', '#0a1838'], on: true, glyph: '⏱' },
  { id: 'special', name: 'SPECIAL', sub: 'Special', jp: 'スペシャル', desc: '期間限定のチャレンジイベント。指定の条件で目標タイムを切れば特別報酬!', reward: '高額クレジット / TP', grad: ['#9a2ad0', '#1a0a30'], on: true, glyph: '★' },
  { id: 'story', name: 'STORY', sub: 'Single-Player', jp: 'ストーリー', desc: '各地の峠に君臨する走り屋たちが君を待ち受ける!戦いを重ねて卓越した技術を手に入れろ。', reward: 'ストーリー報酬', grad: ['#d07a1a', '#301a06'], on: false, glyph: '章' },
  { id: 'battle', name: 'COURSE BATTLE', sub: 'Course Battle', jp: 'コースバトル', desc: 'CPUライバルと1対1のバトル。難易度を選んで、峠の頂点を奪い取れ!', reward: '勝利ボーナス / TP', grad: ['#d01a2a', '#300608'], on: true, glyph: 'VS' },
  { id: 'local', name: 'LOCAL BATTLE', sub: 'Local Battle', jp: 'ローカルバトル', desc: '同じ端末・同じネットワーク内のプレイヤーと対戦。', reward: '—', grad: ['#1ab07a', '#062a1a'], on: false, glyph: 'LAN' },
  { id: 'online', name: 'ONLINE BATTLE', sub: 'Online Battle', jp: 'オンラインバトル', desc: 'CODE BATTLE(ルームコード対戦)と WORLDWIDE MATCH(世界マッチング)。', reward: 'オンラインRP', grad: ['#1a9ad0', '#06202e'], on: false, glyph: 'NET' },
  { id: 'garage', name: 'GARAGE', sub: 'Garage', jp: 'ガレージ', desc: '登録車両の切替・追加登録(最大5台)・ドレスアップ・ホイール・メーター・チューニング。', reward: '', grad: ['#8a8f98', '#16181c'], on: true, glyph: '⚙' },
  { id: 'profile', name: 'PROFILE', sub: 'Profile', jp: 'プロフィール', desc: 'プレイヤー情報・戦績・アカウント状態・同期状態の確認。', reward: '', grad: ['#4a4ad0', '#0a0a28'], on: true, glyph: 'ID' },
  { id: 'settings', name: 'SETTINGS', sub: 'Settings', jp: '設定', desc: 'BGM・効果音、トランスミッション、ドリフトアシスト、カメラ、タッチ操作、カスタマイズ時間制限。', reward: '', grad: ['#4a8a4a', '#0a1a0a'], on: true, glyph: '⚙' },
];
const modeArt = (m) => `background: radial-gradient(ellipse at 70% 40%, ${m.grad[0]}ee, transparent 70%), repeating-linear-gradient(115deg, rgba(255,255,255,.07) 0 4px, transparent 4px 18px), linear-gradient(160deg, ${m.grad[0]}, ${m.grad[1]})`;

UI.register({
  id: 'mode',
  build(n) {
    n.innerHTML = `${backdrop([[760, 40], [1890, 40], [1890, 640], [640, 640]])}
      <div class="m-art" style="position:absolute;left:640px;top:40px;width:1250px;height:600px;clip-path:polygon(120px 0,100% 0,100% 100%,0 100%);z-index:1"></div>
      <canvas class="m-cv" width="1250" height="600" style="position:absolute;left:640px;top:40px;width:1250px;height:600px;clip-path:polygon(120px 0,100% 0,100% 100%,0 100%);z-index:2"></canvas>
      <div class="af-title" style="left:840px;top:58px"><div class="t">MODE SELECT</div></div>
      <div class="bigtimer m-tm"><b>60</b></div>
      <div class="m-name" style="position:absolute;right:80px;top:380px;text-align:right;z-index:4"></div>
      <div class="pp"></div>
      <div class="m-desc" style="position:absolute;left:40px;top:250px;width:560px;z-index:4;padding:22px 26px;background:linear-gradient(90deg,rgba(0,110,140,.85),rgba(0,60,80,.6));border-left:6px solid #36c3ff;clip-path:polygon(0 0,100% 0,94% 100%,0 100%);font-family:var(--jp);font-weight:900;font-size:24px;line-height:40px;color:#fff"></div>
      <div class="m-reward" style="position:absolute;left:40px;top:470px;width:560px;z-index:4"></div>
      <div class="hintbar" style="top:640px">モードを選択してください</div>
      <div class="strip m-strip" style="top:690px"></div>
      <div class="cbx"></div>${logoMark()}${keyGuide()}`;
  },
  enter() {
    App.gfx.setView(null);
    $('.pp', this.el).innerHTML = plate(); $('.cbx', this.el).innerHTML = consoleBox();
    const strip = $('.m-strip', this.el);
    strip.innerHTML = '<i class="mk l"></i>' + MODES.map(m => `<div class="scard" style="width:200px;${modeArt(m)}"><div style="position:absolute;left:34px;top:10px;font-size:15px;font-style:italic;color:#eee">${m.sub}</div><div style="position:absolute;left:0;right:0;top:34px;text-align:center;font-size:48px;color:rgba(255,255,255,.25)">${m.glyph}</div>
      <div class="lab" style="background:linear-gradient(90deg,${m.on ? '#2a8a3a,#8adc4a' : '#555,#888'})">${m.jp}</div>${!m.on ? '<div class="tag" style="top:40px;background:#444;color:#ffd400">準備中</div>' : ''}</div>`).join('') + '<i class="mk r"></i>';
    const cards = $$('.scard', strip);
    this.focus = new Focus(cards, { axis: 'h', index: this.last || 0, onChange: (i) => this.show(i), onSelect: (i) => this.pick(i) });
    const ap = this.focus.apply.bind(this.focus); this.focus.apply = () => { ap(); cards.forEach((c, k) => c.classList.toggle('sel', k === this.focus.i)); };
    this.focus.apply(); this.show(this.focus.i);
    Audio.playMusic('menu');
    bigTimer($('.m-tm', this.el), 60, () => this.pick(this.focus.i));
  },
  leave() { stopTimer(); },
  show(i) {
    const m = MODES[i]; this.last = i;
    $('.m-art', this.el).style.cssText += ';' + modeArt(m);
    $('.m-name', this.el).innerHTML = `<div style="font-size:36px;font-style:italic;color:#fff;text-shadow:0 3px 0 #000">${m.sub}</div><div style="font-size:120px;line-height:116px;font-style:italic;color:#fff;-webkit-text-stroke:3px #111;text-shadow:0 8px 0 #000,0 0 30px ${m.grad[0]}">${m.name.split(' ').pop()}</div><div style="font-family:var(--jp);font-weight:900;font-size:44px;color:#ffd400;-webkit-text-stroke:1px #000;text-shadow:0 4px 0 #000">${m.jp}</div>${!m.on ? '<div style="margin-top:10px;display:inline-block;padding:6px 24px;background:#111;border:3px solid #ffd400;color:#ffd400;font-family:var(--jp);font-weight:900;font-size:26px">現在プレイできません</div>' : ''}`;
    $('.m-desc', this.el).textContent = m.desc;
    $('.m-reward', this.el).innerHTML = m.reward ? `<div style="display:flex;align-items:center;gap:16px;padding:12px 24px;background:linear-gradient(90deg,#ffd000,#ff9a00);clip-path:polygon(0 0,100% 0,95% 100%,0 100%);color:#111;font-family:var(--jp);font-weight:900;font-size:24px"><span style="background:#111;color:#ffd000;padding:2px 14px">報酬</span>${esc(m.reward)}</div>` : '';
    const c = $('.m-cv', this.el), g = c.getContext('2d'); g.clearRect(0, 0, 1250, 600);
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 50; k++) { const y = Math.random() * 600; g.strokeStyle = `rgba(255,${150 + Math.random() * 100},80,${0.04 + Math.random() * 0.14})`; g.lineWidth = 1 + Math.random() * 4; g.beginPath(); g.moveTo(Math.random() * 500, y); g.lineTo(1250, y - 140); g.stroke(); }
    g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(255,255,255,.10)'; g.font = 'italic 900 330px "Arial Black"'; g.fillText(m.glyph, 150, 420);
  },
  async pick(i) {
    const m = MODES[i]; stopTimer();
    if (!m.on) {
      Audio.ui('error');
      const extra = m.id === 'online' ? '<br><br><b style="color:#36c3ff">CODE BATTLE</b>:ルームコードを発行してフレンドと対戦<br><b style="color:#36c3ff">WORLDWIDE MATCH</b>:ランク別の自動マッチング' + (Net.isConfigured() ? '' : '<br>※ サーバー設定後に有効になります。') : '';
      await dialog.alert(m.name, `「${m.jp}」は現在プレイできません。<br>今後のアップデートで解放予定です。${extra}`);
      return bigTimer($('.m-tm', this.el), 60, () => this.pick(this.focus.i));
    }
    Audio.ui('ok');
    if (m.id === 'trial' || m.id === 'battle') { App.pending.mode = m.id; App.pending.event = null; UI.go('course'); }
    else if (m.id === 'special') UI.go('special');
    else if (m.id === 'garage') UI.go('garage');
    else if (m.id === 'profile') UI.go('profile');
    else UI.go('settings', { back: 'mode' });
  },
  async onAction(a) {
    if (a === 'back') {
      stopTimer();
      Audio.ui('back'); return UI.go('start');
    }
    this.focus.action(a);
  },
});

// ───────────────────────── CAR SELECT (register / add) ─────────────────────────
UI.register({
  id: 'carselect',
  build(n) {
    n.innerHTML = `<div class="rotzone" style="position:absolute;left:600px;right:640px;top:120px;bottom:420px;z-index:4"></div>
      ${backdrop([[640, 110], [1890, 110], [1890, 640], [560, 640]], { tone: '#ddd6c4' })}
      <div class="af-title" style="left:50%;top:20px;transform:translateX(-50%);text-align:center"><div class="t">CAR SELECT</div><div class="timer af-tm cs-tm" style="text-align:center"><b>1:30</b></div></div>
      <div class="pp"></div>
      <div class="cs-maker" style="position:absolute;left:0;top:250px;width:600px;height:240px;z-index:5;background:linear-gradient(180deg,#fff,#e8e8e8);clip-path:polygon(0 0,100% 0,90% 100%,0 100%);display:grid;place-items:center;box-shadow:0 6px 0 #000"></div>
      <div class="cs-cat" style="position:absolute;left:30px;top:510px;width:520px;z-index:5;font-family:var(--jp);font-weight:900;font-size:22px;line-height:36px;color:#222"></div>
      <div class="icard cs-info" style="right:40px;top:150px;width:620px"></div>
      <div class="hintbar cs-hint" style="top:640px">クルマを選んでください</div>
      <div class="strip cs-strip" style="top:690px"></div>
      <div class="menutiles cs-menu" style="top:695px"></div>
      <div class="cbx"></div>${logoMark()}${keyGuide([['dpad', '選択'], ['ud', 'メーカー'], ['ok', '決定'], ['back', '戻る']])}`;
  },
  enter(params = {}) {
    this.mode = params.mode || 'add';
    App.gfx.setView(App.showroom); App.showroom.setWindow(0.47, 0.37, 0.72); App.showroom.setPreset('free');
    $('.pp', this.el).innerHTML = plate(); $('.cbx', this.el).innerHTML = consoleBox();
    if (this.mode === 'add' && !Save.canAddCar()) { dialog.alert('CAR ADD', `登録可能な車両は最大${MAX_GARAGE}台です。<br>ガレージで車両を削除すると空き枠を作れます。`).then(() => UI.go('garage')); return; }
    this.makers = Object.keys(MAKERS).filter(mk => CARS.some(c => c.maker === mk));
    this.mi = this.mi || 0; this.zone = 'list';
    this.renderMaker();
    startClock($('.cs-tm', this.el), 90, () => this.zone === 'list' ? this.openMenu() : this.mf.select());
  },
  leave() { stopClock(); },
  renderMaker() {
    const mk = this.makers[this.mi]; const m = MAKERS[mk];
    this.list = CARS.filter(c => c.maker === mk).sort((a, b) => a.price - b.price);
    $('.cs-maker', this.el).innerHTML = `<div style="text-align:center"><div style="display:inline-grid;place-items:center;width:110px;height:110px;border-radius:50%;border:8px solid ${m.color};font-size:56px;font-style:italic;color:${m.color}">${m.name[0]}</div><div style="font-size:64px;font-style:italic;color:${m.color};letter-spacing:4px;line-height:70px">${m.name}</div><div style="font-family:var(--jp);font-weight:900;font-size:22px;color:#333">${m.jp} · ${this.mi + 1}/${this.makers.length}</div></div>`;
    const strip = $('.cs-strip', this.el);
    strip.innerHTML = '<i class="mk l"></i>' + this.list.map(c => {
      const owned = Save.profile.cars.some(g => g.carId === c.id);
      return `<div class="scard" style="background:linear-gradient(180deg,#3a3e46,#15171b)"><img src="${carThumb(c.id, { color: { hex: '#f2f2ef', finish: 'gloss' }, v2: false })}" style="object-fit:contain;inset:10px 20px 46px;width:calc(100% - 40px);height:calc(100% - 56px)"><div class="lab" style="background:rgba(0,0,0,.6);font-family:var(--font);font-style:italic;font-size:20px">${c.name}</div>${this.mode === 'register' ? '<div class="tag">おすすめ</div><div class="new">New</div>' : owned ? '<div class="tag" style="background:#3dff8a">所有中</div>' : `<div class="tag">¥${c.price.toLocaleString()}</div>`}</div>`;
    }).join('') + '<i class="mk r"></i>';
    const cards = $$('.scard', strip);
    this.focus = new Focus(cards, { axis: 'h', index: 0, onChange: (i) => this.show(i), onSelect: () => this.openMenu() });
    const ap = this.focus.apply.bind(this.focus); this.focus.apply = () => { ap(); cards.forEach((c, k) => c.classList.toggle('sel', k === this.focus.i)); };
    this.focus.apply(); this.show(0);
  },
  show(i) {
    const c = this.list[i]; const spec = buildSpec(c); const st = carStats(spec);
    App.showroom.setCar(spec, { color: { hex: '#f2f2ef', finish: 'gloss' } });
    $('.cs-cat', this.el).innerHTML = `<div style="display:inline-block;padding:4px 20px;background:#111;color:#ffd400;font-family:var(--font);font-style:italic">${c.category}</div> ${c.catJp}<div style="margin-top:8px">${esc(c.desc)}</div>`;
    $('.cs-info', this.el).innerHTML = `<div class="nm">${c.name} <span style="font-size:20px;color:#666">[${c.year}]</span></div>
      <div class="chipr"><span style="font-family:var(--jp);font-weight:900;font-size:16px;color:#666">車種属性</span>${attrChips(c)}<span style="margin-left:auto;font-size:22px;font-style:italic">${c.drive} / ${c.gears.length}速</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 20px;margin:12px 0;font-family:var(--jp);font-weight:900;font-size:19px">
        <span>メーカー</span><b style="text-align:right">${MAKERS[c.maker].name}</b><span>最高出力</span><b style="text-align:right">${c.engine.hp} PS</b>
        <span>排気量</span><b style="text-align:right">${c.disp.toLocaleString()} cc</b><span>車両重量</span><b style="text-align:right">${c.mass} kg</b>
        <span>車両タイプ</span><b style="text-align:right">${c.body.style.toUpperCase()}</b><span>価格</span><b style="text-align:right;color:#c60">${this.mode === 'register' ? '無料' : '¥' + c.price.toLocaleString()}</b></div>
      ${segBars(STAT6, st)}`;
  },
  openMenu() {
    Audio.ui('ok'); this.zone = 'menu';
    $('.cs-strip', this.el).style.display = 'none'; const m = $('.cs-menu', this.el); m.style.display = 'flex';
    $('.cs-hint', this.el).textContent = 'メニューを選んでください';
    m.innerHTML = `<div class="mtile y">🔑 使用登録</div><div class="mtile b">ドレスアップ</div><div class="mtile k">前に戻る</div>`;
    const tiles = $$('.mtile', m);
    this.mf = new Focus(tiles, { axis: 'h', onSelect: (k) => k === 0 ? this.register(false) : k === 1 ? this.register(true) : this.closeMenu() });
    const ap = this.mf.apply.bind(this.mf); this.mf.apply = () => { ap(); tiles.forEach((t, k) => t.classList.toggle('sel', k === this.mf.i)); }; this.mf.apply();
  },
  closeMenu() { Audio.ui('back'); this.zone = 'list'; $('.cs-menu', this.el).style.display = 'none'; $('.cs-strip', this.el).style.display = 'flex'; $('.cs-hint', this.el).textContent = 'クルマを選んでください'; },
  async register(thenDress) {
    const c = this.list[this.focus.i];
    if (!Save.canAddCar()) { await dialog.alert('CAR ADD', `登録可能な車両は最大${MAX_GARAGE}台です`); return; }
    const price = this.mode === 'register' ? 0 : c.price;
    if (price > Save.profile.credits) { Audio.ui('error'); return dialog.alert('クレジット不足', `この車両の登録には ¥${price.toLocaleString()} 必要です。<br>(所持: ¥${Save.profile.credits.toLocaleString()})`); }
    if (!(await dialog.confirm('使用登録', `<b style="font-size:40px">${c.name}</b><br>この車両をガレージに登録しますか?${price ? `<br>価格: <b style="color:#ffd400">¥${price.toLocaleString()}</b>` : ''}<br><span style="font-size:22px;color:#aaa">登録台数 ${Save.profile.cars.length + 1} / ${MAX_GARAGE}</span>`, '登録する', 'やめる'))) return;
    Save.profile.credits -= price;
    const gc = Save.addCar(c.id); Save.setActive(gc.uid);
    await Save.persistNow('car-add');
    Audio.ui('coin'); toast(`${c.name} を登録しました`);
    if (thenDress || this.mode === 'register') UI.go('dressup', { uid: gc.uid, flow: this.mode === 'register' ? 'register' : 'garage' });
    else UI.go(App.takeReturn('garage'));
  },
  onAction(a) {
    if (a === 'back') { if (this.zone === 'menu') return this.closeMenu(); if (this.mode === 'register') { Audio.ui('error'); toast('最初の1台を登録してください'); return; } Audio.ui('back'); return UI.go(App.takeReturn('garage')); }
    if (this.zone === 'list' && (a === 'up' || a === 'down')) { this.mi = (this.mi + (a === 'up' ? -1 : 1) + this.makers.length) % this.makers.length; Audio.ui('move'); return this.renderMaker(); }
    (this.zone === 'menu' ? this.mf : this.focus).action(a);
  },
});

// ───────────────────────── GARAGE (owned cars) ─────────────────────────
UI.register({
  id: 'garage',
  build(n) {
    n.innerHTML = `<div class="rotzone" style="position:absolute;left:640px;right:40px;top:80px;bottom:440px;z-index:4"></div>
      ${backdrop([[760, 0], [1920, 0], [1920, 1080], [440, 1080]], { tone: '#ddd6c4', frame: false })}
      <div class="af-title" style="left:50%;top:20px;transform:translateX(-50%);text-align:center"><div class="t">CAR CUSTOMIZE</div><div class="timer af-tm g-tm" style="text-align:center"><b>3:00</b></div></div>
      <div class="pp"></div>
      <div class="g-list" style="position:absolute;left:0;top:215px;width:620px;z-index:5;display:flex;flex-direction:column;gap:6px"></div>
      <div class="icard g-info" style="right:40px;top:140px;width:600px"></div>
      <div class="hintbar g-hint" style="top:640px">メニューを選んでください(↑↓で車両切替)</div>
      <div class="strip g-menu" style="top:690px"></div>
      <div class="cbx"></div>${logoMark()}${keyGuide([['ud', '車両'], ['lr', 'メニュー'], ['ok', '決定'], ['back', '戻る']])}`;
  },
  enter(params = {}) {
    App.gfx.setView(App.showroom); App.showroom.setWindow(0.5, 0.38, 0.74); App.showroom.setPreset('free');
    $('.pp', this.el).innerHTML = plate(); $('.cbx', this.el).innerHTML = consoleBox();
    this.ci = Math.max(0, Save.profile.cars.findIndex(c => c.uid === Save.profile.activeCar));
    this.render();
    const items = [['使用登録', 'use', 'Car Select', 'key'], ['カーカスタマイズ', 'dress', 'Car Customize', 'car'], ['ホイール', 'wheel', 'Wheel', 'wheel'], ['メーター', 'meter', 'Meter', 'meter'], ['チューニング', 'tune', 'Tuning', 'wrench'], ['IN-STORE', 'store', 'Parts Shop', 'bag'], ['車両追加', 'add', 'Car Add', 'plus'], ['車両削除', 'del', 'Delete', 'trash'], ['モード選択', 'back', 'Mode Select', 'back']];
    const m = $('.g-menu', this.el);
    m.innerHTML = '<i class="mk l"></i>' + items.map(([l, a, en, ic]) => `<div class="scard hub" data-a="${a}" style="width:190px"><div class="en">${en}</div><div class="ic">${hubIcon(ic)}</div><div class="lab" style="background:linear-gradient(90deg,#0a5ac0,#2aa8ff)">${l}</div></div>`).join('') + '<i class="mk r"></i>';
    const tiles = $$('.scard', m);
    this.mf = new Focus(tiles, { axis: 'h', index: params.menu || 0, onSelect: (k, t) => this.run(t.dataset.a) });
    const ap = this.mf.apply.bind(this.mf); this.mf.apply = () => { ap(); tiles.forEach((t, k) => t.classList.toggle('sel', k === this.mf.i)); }; this.mf.apply();
    startClock($('.g-tm', this.el), 180, async () => { await Save.persistNow('timeout'); toast('時間切れ — データを保存しました'); UI.go(App.takeReturn('shopcust')); });
  },
  leave() { stopClock(); },
  render() {
    const p = Save.profile; const list = $('.g-list', this.el);
    let html = '';
    for (let i = 0; i < MAX_GARAGE; i++) {
      const c = p.cars[i];
      html += c ? `<div class="gcar" data-i="${i}" style="position:relative;height:96px;display:flex;align-items:center;gap:14px;padding:0 40px 0 20px;cursor:pointer;background:${i === this.ci ? 'linear-gradient(90deg,#fff6c8,#ffd84a)' : 'linear-gradient(90deg,#f6f6f6,#d6d9de)'};clip-path:polygon(0 0,100% 0,95% 100%,0 100%);${i === this.ci ? 'filter:drop-shadow(0 0 10px #ffb000)' : ''};color:#111">
          <img src="${carThumb(c.carId, c.dress)}" style="width:140px;height:80px;object-fit:contain"><div style="flex:1;min-width:0"><div style="font-size:24px;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</div>
          <div class="chipr" style="margin-top:2px">${attrChips(carById(c.carId))}<span style="margin-left:auto;font-size:18px;font-style:italic">${c.drive} / ${carById(c.carId).gears.length}速</span></div></div>
          <div style="position:absolute;right:46px;top:6px;font-size:14px;padding:1px 10px;background:#111;color:#ffd400;font-style:italic">${tuneLevel(c)}</div>${c.uid === p.activeCar ? '<div style="position:absolute;left:8px;top:6px;font-family:var(--jp);font-weight:900;font-size:14px;color:#c00;background:#ffe24a;border:2px solid #c00;padding:0 6px">使用中</div>' : ''}</div>`
        : `<div class="gcar" data-i="${i}" style="height:96px;display:grid;place-items:center;cursor:pointer;background:rgba(40,40,44,.7);clip-path:polygon(0 0,100% 0,95% 100%,0 100%);font-family:var(--jp);font-weight:900;font-size:22px;color:#bbb">空き枠 ${i + 1} — 車両追加で登録できます</div>`;
    }
    list.innerHTML = html;
    $$('.gcar', list).forEach(n => n.onclick = () => { const i = +n.dataset.i; if (!p.cars[i]) return this.run('add'); this.ci = i; Audio.ui('move'); this.render(); });
    const c = p.cars[this.ci]; if (!c) return;
    const spec = App.specOf(c); App.showroom.setCar(spec, c.dress, { teamName: p.teamName });
    const base = carById(c.carId);
    $('.g-info', this.el).innerHTML = `<div class="nm">${esc(c.name)}</div><div class="chipr">${attrChips(base)}<span style="margin-left:auto;font-size:20px;font-style:italic">${c.drive} / ${base.gears.length}速</span></div>
      <div style="display:flex;justify-content:space-between;margin:8px 0;font-family:var(--jp);font-weight:900;font-size:18px"><span>チューニングレベル</span><span style="color:#c00;font-family:var(--font);font-style:italic">${tuneLevel(c)}</span></div>
      ${segBars(STAT6, carStats(spec))}<div style="margin-top:8px;font-size:16px;color:#555">${spec.engine.hp}PS / ${spec.mass}kg · 登録日 ${new Date(c.registeredAt).toLocaleDateString('ja-JP')}</div>`;
  },
  async run(a) {
    const p = Save.profile; const c = p.cars[this.ci];
    if (a === 'back') { Audio.ui('back'); await Save.persistNow('garage'); return UI.go(App.takeReturn('shopcust')); }
    if (a === 'add') { if (!Save.canAddCar()) { Audio.ui('error'); return dialog.alert('CAR ADD', `登録可能な車両は最大${MAX_GARAGE}台です`); } Audio.ui('ok'); return UI.go('carselect', { mode: 'add' }); }
    if (!c) return;
    if (a === 'use') { Save.setActive(c.uid); Audio.ui('ok'); toast(`${c.name} を使用車両に登録しました`); return this.render(); }
    if (a === 'dress') { Audio.ui('ok'); return UI.go('dressup', { uid: c.uid, flow: 'garage' }); }
    if (a === 'wheel') { Audio.ui('ok'); return UI.go('wheel', { uid: c.uid, back: 'garage' }); }
    if (a === 'meter') { Audio.ui('ok'); return UI.go('meter', { uid: c.uid }); }
    if (a === 'tune') { Audio.ui('ok'); return UI.go('tuning', { uid: c.uid }); }
    if (a === 'store') { Audio.ui('ok'); return UI.go('store', { uid: c.uid }); }
    if (a === 'del') {
      if (p.cars.length <= 1) { Audio.ui('error'); return dialog.alert('削除できません', '最低1台の車両が必要です。'); }
      if (!(await dialog.confirm('車両の削除', `<b>${esc(c.name)}</b>(${tuneLevel(c)})を削除しますか?<br><span style="color:#ff6a6a">チューニング・ドレスアップも失われます。元に戻せません。</span>`, '削除する', 'やめる'))) return;
      Save.removeCar(c.uid); await Save.persistNow('car-remove'); toast('車両を削除しました'); this.ci = 0; this.render();
    }
  },
  onAction(a) {
    if (a === 'back') return this.run('back');
    const n = Save.profile.cars.length;
    if (a === 'up' || a === 'down') { this.ci = (this.ci + (a === 'up' ? -1 : 1) + n) % n; Audio.ui('move'); return this.render(); }
    this.mf.action(a);
  },
});

// ───────────────────────── DRESS UP ─────────────────────────
const DRESS_CATS = [
  { k: 'color', jp: 'ボディカラー', icon: 'body', band: '#e06a00' },
  { k: 'finish', jp: '塗装仕上げ', icon: 'body', band: '#e06a00' },
  { k: 'v_side', jp: 'サイドステッカー', icon: 'vinyl', band: '#e06a00' },
  { k: 'v_hood', jp: 'ボンネットステッカー', icon: 'hood', band: '#e06a00' },
  { k: 'v_rear', jp: 'リアステッカー', icon: 'rear', band: '#e06a00' },
  { k: 'v_stripe', jp: 'ストライプ', icon: 'vinyl', band: '#e06a00' },
  ...Object.entries(AERO).map(([k, v]) => ({ k: 'a_' + k, jp: v.jp, icon: v.icon, band: v.band })),
  { k: 'wheel', jp: 'ホイール', icon: 'wheel', band: '#1a7ad0' },
  { k: 'height', jp: '車高調整', icon: 'height', band: '#2a9a3a' },
];
UI.register({
  id: 'dressup',
  build(n) {
    n.innerHTML = `<div class="rotzone" style="position:absolute;left:620px;right:40px;top:40px;bottom:400px;z-index:4"></div>
      ${backdrop([[640, 40], [1890, 40], [1890, 690], [520, 690]])}
      ${titleTimer('DRESS UP', 'du-tm').replace('class="af-title"', 'class="af-title" style="left:760px;top:56px"')}
      <div class="viewbtns"><b data-v="three">3/4</b><b data-v="front">前</b><b data-v="rear">後</b><b data-v="left">左</b><b data-v="right">右</b><b data-v="top">上</b><b data-v="free">回転</b></div>
      <div class="adj"></div>
      <div class="pp"></div><div class="vcat"></div>
      <div style="position:absolute;left:520px;right:0;top:700px;height:300px;overflow:hidden;z-index:5"><div class="hrow" style="left:40px;top:60px;right:auto"></div></div>
      <div class="pdesc"></div>
      <div class="cbx"></div>${logoMark()}${keyGuide([['ud', '項目'], ['lr', 'パーツ'], ['ok', '決定'], ['back', '戻る']])}`;
    $$('.viewbtns b', n).forEach(b => b.onclick = () => this.view(b.dataset.v));
  },
  enter(params = {}) {
    this.params = params;
    const gc = Save.profile.cars.find(c => c.uid === params.uid) || Save.activeCar; normalizeCar(gc); this.gc = gc;
    this.base = carById(gc.carId); this.spec = App.specOf(gc);
    this.draft = JSON.parse(JSON.stringify(gc.dress));
    App.gfx.setView(App.showroom); App.showroom.setWindow(0.64, 0.33, 1.0); this.view('three');
    this.redraw();
    $('.pp', this.el).innerHTML = plate(); $('.cbx', this.el).innerHTML = consoleBox();
    this.ci = params.cat ?? 0; this.adjusting = false;
    this.layout = renderVcat($('.vcat', this.el), DRESS_CATS, this.ci, (i) => { this.ci = i; Audio.ui('move'); this.layout(i); this.renderParts(); });
    this.renderParts();
    startClock($('#du-tm'), 180, () => this.finish(true));
  },
  leave() { stopClock(); App.showroom.setPreset('free'); },
  view(v) { App.showroom.setPreset(v); $$('.viewbtns b', this.el).forEach(b => b.classList.toggle('on', b.dataset.v === v)); },
  redraw() { App.showroom.setCar(this.spec, this.draft, { teamName: Save.profile.teamName }); },
  // list of options for the current category: [{html, value, desc, locked}]
  options() {
    const k = DRESS_CATS[this.ci].k, d = this.draft, style = this.base.body.style;
    if (k === 'color') return PALETTE.map(([nm, hex]) => ({ html: `<div class="sw" style="background:${hex}"></div><div class="cap">${nm}</div>`, value: hex, desc: `ボディカラー:${nm}`, cur: d.color.hex === hex }));
    if (k === 'finish') return FINISHES.map(f => ({ html: `<div style="text-align:center"><div class="sw" style="margin:auto;background:${d.color.hex};${f.id === 'matte' ? 'box-shadow:none' : f.id === 'pearl' ? 'background-image:linear-gradient(135deg,rgba(255,255,255,.5),rgba(180,200,255,.3),rgba(255,220,255,.4))' : ''}"></div><div style="font-size:22px;font-style:italic;color:#333">${f.name}</div></div>`, value: f.id, desc: `塗装仕上げ:${f.jp}`, cur: d.color.finish === f.id }));
    if (k.startsWith('v_')) {
      const slot = k.slice(2); return VINYL_SLOTS[slot].designs.map(ds => ({ locked: Save.owns('vinyl', ds) ? null : `IN-STOREで購入 ¥${partPrice('vinyl', ds).toLocaleString()}`, html: `<div style="font-family:var(--jp);font-weight:900;font-size:26px;color:#222;text-align:center">${ds === 'none' ? 'なし' : VINYL_NAMES[ds]}<small style="display:block;font-size:14px;color:#888;font-family:var(--font)">${ds === 'none' ? 'Normal' : 'ORIGINAL VINYL'}</small></div>`, value: ds, desc: `${VINYL_SLOTS[slot].jp}:${VINYL_NAMES[ds]}${ds !== 'none' ? ' — 決定で位置・サイズ・角度を調整' : ''}`, cur: d.vinyl[slot].d === ds }));
    }
    if (k.startsWith('a_')) {
      const cat = k.slice(2); const def = AERO[cat]; const curV = cat === 'muffler' ? d.muffler : d.aero[cat];
      const turboOK = !def.turboOnly || this.base.sound.turbo;
      return def.list.map(it => ({ html: brandMark(it.brand), value: it.id, desc: `${PART_BRANDS[it.brand].name} ${it.name}`, cur: curV === it.id,
        locked: !isCompatible(style, cat, it.id) || (!turboOK && it.id) ? (turboOOK(turboOK, it.id)) : Save.owns(cat, it.id) ? null : `IN-STOREで購入 ¥${partPrice(cat, it.id).toLocaleString()}` }));
    }
    if (k === 'wheel') { const f = d.wheel.f; const des = WHEEL_DESIGNS.find(w => w.id === f.design); return [{ html: `<canvas width="260" height="260"></canvas>`, value: 'open', desc: `${des.brand ? WHEEL_BRANDS[des.brand].name : 'Normal'} ${des.name} ${f.size}inch — 決定でホイールカスタマイズへ`, cur: true, wheel: f }]; }
    if (k === 'height') return RIDE_HEIGHTS.map(h => ({ html: `<div style="font-size:26px;font-style:italic;color:#222;text-align:center">${h.name}</div>`, value: h.id, desc: `車高:${h.name}`, cur: (d.height || 0) === h.id }));
    return [];
  },
  renderParts() {
    const opts = this.options(); this.opts = opts;
    const eq = Math.max(0, opts.findIndex(o => o.cur));
    this.sel = { i: eq }; this.eq = eq;
    this.mark = renderRow($('.hrow', this.el), opts, this.sel, eq, (i, click) => { this.sel.i = i; this.mark(); this.preview(); if (click) this.equip(); });
    $$('.hrow canvas', this.el).forEach(cv => paintWheel(cv, opts[0].wheel));
    this.descr();
    this.closeAdj();
  },
  descr() { $('.pdesc', this.el).textContent = this.opts[this.sel.i]?.desc || ''; },
  apply(val) {
    const k = DRESS_CATS[this.ci].k, d = this.draft;
    if (k === 'color') d.color.hex = val;
    else if (k === 'finish') d.color.finish = val;
    else if (k.startsWith('v_')) d.vinyl[k.slice(2)].d = val;
    else if (k === 'a_muffler') d.muffler = val;
    else if (k.startsWith('a_')) d.aero[k.slice(2)] = val;
    else if (k === 'height') d.height = val;
  },
  preview() { const o = this.opts[this.sel.i]; if (!o || o.value === 'open') return this.descr(); if (o.locked && !/IN-STORE/.test(o.locked)) { this.descr(); return; } this.apply(o.value); this.redraw(); this.descr(); },
  // Enter: equip the selected part (it becomes 装着中 and is saved)
  equip() {
    const o = this.opts[this.sel.i]; const k = DRESS_CATS[this.ci].k;
    if (!o) return;
    if (o.locked) { Audio.ui('error'); toast(o.locked); return; }
    if (o.value === 'open') { this.commit(); Audio.ui('ok'); return UI.go('wheel', { uid: this.gc.uid, back: 'dressup', flow: this.params.flow }); }
    this.apply(o.value); this.commit(); Audio.ui('ok');
    if (k === 'a_muffler') this.revSample();
    this.eq = this.sel.i; this.mark = renderRow($('.hrow', this.el), this.opts.map((x, i) => ({ ...x, cur: i === this.sel.i })), this.sel, this.sel.i, (i, click) => { this.sel.i = i; this.mark(); this.preview(); if (click) this.equip(); });
    if (k.startsWith('v_') && o.value !== 'none') this.openAdj(k.slice(2));
  },
  commit() { this.gc.dress = JSON.parse(JSON.stringify(this.draft)); Save.touch('dress'); this.equipped = JSON.parse(JSON.stringify(this.draft)); },
  revert() { // leaving a category without equipping restores the equipped state
    const g = this.gc.dress; this.draft = JSON.parse(JSON.stringify(g)); this.redraw();
  },
  revSample() {
    if (!Audio.ctx) return; const m = { stock: 0, dual: 0.15, big: 0.3, quad: 0.25 }[this.draft.muffler] || 0;
    const e = Audio.createEngine(this.spec, { muffler: m }); if (!e) return;
    const v = { rpm: 2500, limiterHit: 0, boost: 0, slipRear: 0, slipFront: 0, speed: 0 }; let t = 0;
    const h = setInterval(() => { t += 0.05; v.rpm = 2500 + Math.sin(t * 3) ** 2 * 5000; e.update(v, 1); if (t > 1.3) { clearInterval(h); e.stop(); } }, 50);
  },
  openAdj(slot) {
    this.adjusting = slot; const a = $('.adj', this.el); a.classList.add('on');
    const v = this.draft.vinyl[slot];
    const row = (lab, key, step, fmt) => `<div class="r"><label>${lab}</label><button data-k="${key}" data-d="${-step}">◀</button><span>${fmt(v[key])}</span><button data-k="${key}" data-d="${step}">▶</button></div>`;
    a.innerHTML = `<div style="color:#ffd400;margin-bottom:6px">ステッカー調整(${VINYL_SLOTS[slot].jp})</div>
      ${row('左右', 'x', 0.1, x => x.toFixed(1))}${row('上下', 'y', 0.1, x => x.toFixed(1))}${row('サイズ', 's', 0.1, x => Math.round(x * 100) + '%')}${row('角度', 'r', 5, x => x + '°')}
      <div style="font-size:16px;color:#aaa;margin-top:6px">←→ 左右 / ↑↓ 上下 / Q・E 角度 / Z・X サイズ / ENTER 完了</div>`;
    $$('.adj button', a).forEach(b => b.onclick = () => this.nudge(b.dataset.k, +b.dataset.d));
    this._keys = (e) => { const m = { KeyQ: ['r', -5], KeyE: ['r', 5], KeyZ: ['s', -0.1], KeyX: ['s', 0.1] }[e.code]; if (m) { this.nudge(...m); return true; } return false; };
    import('../core/input.js').then(({ Input }) => { Input.textCapture = (e) => this.adjusting ? this._keys(e) : false; });
  },
  closeAdj() { this.adjusting = false; $('.adj', this.el).classList.remove('on'); import('../core/input.js').then(({ Input }) => { Input.textCapture = null; }); },
  nudge(key, d) {
    const v = this.draft.vinyl[this.adjusting]; if (!v) return;
    const lim = { x: [-1, 1], y: [-1, 1], s: [0.4, 1.6], r: [-45, 45] }[key];
    v[key] = Math.max(lim[0], Math.min(lim[1], Math.round((v[key] + d) * 100) / 100));
    Audio.ui('move'); this.redraw(); this.commit(); this.openAdj(this.adjusting);
  },
  async finish(timeout) {
    stopClock(); this.closeAdj();
    this.revert();
    await Save.persistNow('dressup');
    if (timeout) toast('時間切れ — 装着中のパーツを保存しました');
    if (this.params.flow === 'register') {
      App.showroom.setPreset('free');
      await dialog.show({ title: '使用車両登録完了', text: `<b style="font-size:44px">${esc(this.gc.name)}</b><br>ガレージに登録されました!<br>さあ、峠へ向かおう。`, buttons: [{ label: 'メインメニューへ', value: true, cls: 'primary' }] });
      return UI.go('start');
    }
    if (App.hubReturn) return UI.go(App.takeReturn());
    UI.go('garage', { menu: 1 });
  },
  onAction(a) {
    if (this.adjusting) {
      if (a === 'left') return this.nudge('x', -0.1); if (a === 'right') return this.nudge('x', 0.1);
      if (a === 'up') return this.nudge('y', 0.1); if (a === 'down') return this.nudge('y', -0.1);
      if (a === 'ok' || a === 'back') { Audio.ui('ok'); return this.closeAdj(); }
      return;
    }
    if (a === 'back') { Audio.ui('back'); return this.finish(false); }
    if (a === 'up' || a === 'down') { this.revert(); this.ci = (this.ci + (a === 'up' ? -1 : 1) + DRESS_CATS.length) % DRESS_CATS.length; Audio.ui('move'); this.layout(this.ci); return this.renderParts(); }
    if (a === 'left' || a === 'right') { const n = this.opts.length; this.sel.i = (this.sel.i + (a === 'left' ? -1 : 1) + n) % n; Audio.ui('move'); this.mark(); return this.preview(); }
    if (a === 'ok') return this.equip();
  },
});

function hubIcon(k) {
  const P = { key: '<circle cx="34" cy="40" r="14" fill="none" stroke="#fff" stroke-width="7"/><path d="M46 40 H88 M74 40 V54 M84 40 V50" stroke="#fff" stroke-width="7"/>',
    car: '<path d="M14 58 L22 42 L44 38 L56 26 L84 26 L96 40 L108 44 L108 58 Z" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/><circle cx="38" cy="60" r="8" fill="#fff"/><circle cx="88" cy="60" r="8" fill="#fff"/>',
    wheel: '<circle cx="60" cy="42" r="28" fill="none" stroke="#fff" stroke-width="7"/><circle cx="60" cy="42" r="6" fill="#fff"/><path d="M60 16 V36 M60 48 V68 M34 42 H54 M66 42 H86" stroke="#fff" stroke-width="5"/>',
    meter: '<path d="M24 60 A36 36 0 1 1 96 60" fill="none" stroke="#fff" stroke-width="7"/><path d="M60 58 L80 30" stroke="#ff5a5a" stroke-width="6" stroke-linecap="round"/><circle cx="60" cy="58" r="6" fill="#fff"/>',
    wrench: '<path d="M30 70 L66 34 A16 16 0 1 1 82 18 L72 28 L78 34 L88 24 A16 16 0 0 1 72 46 L36 82 Z" fill="#fff" transform="translate(4,-10)"/>',
    bag: '<rect x="28" y="30" width="64" height="44" rx="6" fill="none" stroke="#fff" stroke-width="7"/><path d="M44 30 V22 A16 16 0 0 1 76 22 V30" fill="none" stroke="#fff" stroke-width="6"/><text x="60" y="64" font-size="22" text-anchor="middle" fill="#fff" font-family="Arial Black">¥</text>',
    plus: '<circle cx="60" cy="42" r="28" fill="none" stroke="#fff" stroke-width="7"/><path d="M60 26 V58 M44 42 H76" stroke="#fff" stroke-width="8"/>',
    trash: '<path d="M38 28 H82 M50 28 V20 H70 V28 M42 28 L46 72 H74 L78 28" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>',
    back: '<path d="M80 42 H40 M54 26 L38 42 L54 58" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' };
  return `<svg viewBox="0 0 120 84" width="120" height="84">${P[k] || ''}</svg>`;
}
const turboOOK = (ok, id) => (!ok && id ? 'ターボ車専用パーツ' : 'この車種には装着不可');

// 2D wheel painter for thumbnails
export function paintWheel(cv, cfg) {
  const g = cv.getContext('2d'); const W = cv.width, cx = W / 2, R = W * 0.46;
  const des = WHEEL_DESIGNS.find(d => d.id === cfg.design) || WHEEL_DESIGNS[0];
  const rim = R * (0.52 + ((cfg.size || 16) - 15) * 0.065) / 0.9 * 0.86;
  g.clearRect(0, 0, W, W);
  g.beginPath(); g.arc(cx, cx, R, 0, 7); g.fillStyle = '#151515'; g.fill();
  g.beginPath(); g.arc(cx, cx, rim, 0, 7); g.fillStyle = '#2a2a2a'; g.fill();
  g.lineWidth = des.shape === 'dish' ? 10 : 6; g.strokeStyle = cfg.rim || cfg.color; g.stroke();
  g.save(); g.translate(cx, cx); g.strokeStyle = cfg.color; g.fillStyle = cfg.color; g.lineCap = 'round';
  const n = des.n, sw = Math.max(3, des.w * rim * 4);
  const spoke = (a, w = sw, l0 = rim * 0.2, l1 = rim * 0.95) => { g.lineWidth = w; g.beginPath(); g.moveTo(Math.cos(a) * l0, Math.sin(a) * l0); g.lineTo(Math.cos(a) * l1, Math.sin(a) * l1); g.stroke(); };
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    if (des.shape === 'spoke' || des.shape === 'turbine') spoke(a + (des.shape === 'turbine' ? 0.15 : 0));
    else if (des.shape === 'twin') { spoke(a - 0.09, sw * 0.7); spoke(a + 0.09, sw * 0.7); }
    else if (des.shape === 'mesh') { g.lineWidth = sw * 0.7; g.beginPath(); g.moveTo(Math.cos(a) * rim * 0.2, Math.sin(a) * rim * 0.2); g.lineTo(Math.cos(a + 0.5) * rim * 0.95, Math.sin(a + 0.5) * rim * 0.95); g.stroke(); g.beginPath(); g.moveTo(Math.cos(a) * rim * 0.2, Math.sin(a) * rim * 0.2); g.lineTo(Math.cos(a - 0.5) * rim * 0.95, Math.sin(a - 0.5) * rim * 0.95); g.stroke(); }
    else if (des.shape === 'star') { spoke(a, sw * 1.2, rim * 0.2, rim * 0.55); g.lineWidth = sw * 0.6; g.beginPath(); g.moveTo(Math.cos(a) * rim * 0.55, Math.sin(a) * rim * 0.55); g.lineTo(Math.cos(a - 0.25) * rim * 0.95, Math.sin(a - 0.25) * rim * 0.95); g.moveTo(Math.cos(a) * rim * 0.55, Math.sin(a) * rim * 0.55); g.lineTo(Math.cos(a + 0.25) * rim * 0.95, Math.sin(a + 0.25) * rim * 0.95); g.stroke(); }
  }
  if (des.shape === 'dish') { g.beginPath(); g.arc(0, 0, rim * 0.9, 0, 7); g.fill(); g.fillStyle = '#111'; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * rim * 0.6, Math.sin(a) * rim * 0.6, rim * 0.15, 0, 7); g.fill(); } }
  g.beginPath(); g.arc(0, 0, rim * 0.2, 0, 7); g.fillStyle = cfg.color; g.fill(); g.beginPath(); g.arc(0, 0, rim * 0.09, 0, 7); g.fillStyle = '#111'; g.fill();
  g.restore();
}

// ───────────────────────── WHEEL CUSTOMIZE ─────────────────────────
const WHEEL_CATS = [
  { k: 'design', jp: 'ホイール', icon: 'wheel', band: '#1a7ad0' },
  { k: 'color', jp: 'ホイールカラー', icon: 'wheel', band: '#1a7ad0' },
  { k: 'rim', jp: 'リムカラー', icon: 'wheel', band: '#1a7ad0' },
  { k: 'size', jp: 'インチ', icon: 'wheel', band: '#2a9a3a' },
  { k: 'offset', jp: 'オフセット', icon: 'wheel', band: '#2a9a3a' },
  { k: 'tirew', jp: 'タイヤ幅', icon: 'wheel', band: '#e06a00' },
  { k: 'tire', jp: 'タイヤ外観', icon: 'wheel', band: '#e06a00' },
  { k: 'target', jp: '前後設定', icon: 'wheel', band: '#e06a00' },
];
UI.register({
  id: 'wheel',
  build(n) {
    n.innerHTML = `<div class="rotzone" style="position:absolute;left:620px;right:40px;top:40px;bottom:400px;z-index:4"></div>
      ${backdrop([[640, 40], [1890, 40], [1890, 690], [520, 690]])}
      ${titleTimer('WHEEL', 'wh-tm').replace('class="af-title"', 'class="af-title" style="left:760px;top:56px"')}
      <div class="viewbtns"><b data-v="wheel">ホイール</b><b data-v="left">側面</b><b data-v="three">3/4</b><b data-v="free">回転</b></div>
      <div class="w-target" style="position:absolute;right:70px;top:110px;z-index:6;padding:8px 20px;background:rgba(10,12,16,.85);border:2px solid #36c3ff;font-family:var(--jp);font-weight:900;font-size:22px"></div>
      <div class="pp"></div><div class="vcat"></div>
      <div style="position:absolute;left:520px;right:0;top:700px;height:300px;overflow:hidden;z-index:5"><div class="hrow" style="left:40px;top:60px;right:auto"></div></div>
      <div class="pdesc"></div>
      <div class="cbx"></div>${logoMark()}${keyGuide([['ud', '項目'], ['lr', '選択'], ['ok', '決定'], ['back', '戻る']])}`;
    $$('.viewbtns b', n).forEach(b => b.onclick = () => { App.showroom.setPreset(b.dataset.v); $$('.viewbtns b', n).forEach(x => x.classList.toggle('on', x === b)); });
  },
  enter(params = {}) {
    this.params = params;
    const gc = Save.profile.cars.find(c => c.uid === params.uid) || Save.activeCar; normalizeCar(gc); this.gc = gc;
    this.spec = App.specOf(gc); this.draft = JSON.parse(JSON.stringify(gc.dress));
    this.target = this.draft.wheel.link ? 'both' : 'f';
    App.gfx.setView(App.showroom); App.showroom.setWindow(0.64, 0.33, 1.0); App.showroom.setPreset('wheel');
    $$('.viewbtns b', this.el).forEach(x => x.classList.toggle('on', x.dataset.v === 'wheel'));
    this.redraw();
    $('.pp', this.el).innerHTML = plate(); $('.cbx', this.el).innerHTML = consoleBox();
    this.ci = 0;
    this.layout = renderVcat($('.vcat', this.el), WHEEL_CATS, 0, (i) => { this.ci = i; Audio.ui('move'); this.layout(i); this.renderParts(); });
    this.renderParts();
    startClock($('#wh-tm'), 180, () => this.finish(true));
  },
  leave() { stopClock(); App.showroom.setPreset('free'); },
  redraw() { App.showroom.setCar(this.spec, this.draft, { teamName: Save.profile.teamName }); $('.w-target', this.el).textContent = '編集対象:' + { both: '前後同じ', f: 'フロント', r: 'リア' }[this.target]; },
  cur() { return this.target === 'r' ? this.draft.wheel.r : this.draft.wheel.f; },
  options() {
    const k = WHEEL_CATS[this.ci].k, w = this.cur();
    if (k === 'design') return WHEEL_DESIGNS.map(d => ({ locked: Save.owns('wheel', d.id) ? null : `IN-STOREで購入 ¥${partPrice('wheel', d.id).toLocaleString()}`, html: `<canvas width="200" height="200" style="width:110px;height:110px"></canvas><div class="cap">${d.brand ? WHEEL_BRANDS[d.brand].name : 'Normal'}</div>`, value: d.id, desc: `${d.brand ? WHEEL_BRANDS[d.brand].name + ' / ' : ''}${d.name}`, cur: w.design === d.id, paint: { ...w, design: d.id } }));
    if (k === 'color' || k === 'rim') return WHEEL_COLORS.map(([nm, hex]) => ({ html: `<div class="sw" style="background:${hex}"></div><div class="cap">${nm}</div>`, value: hex, desc: `${k === 'rim' ? 'リム' : 'ホイール'}カラー:${nm}`, cur: w[k] === hex }));
    if (k === 'size') return WHEEL_SIZES.map(s => ({ html: `<div style="font-size:46px;font-style:italic;color:#222">${s}<small style="font-size:20px">inch</small></div>`, value: s, desc: `ホイールサイズ ${s}インチ(大きいほどタイヤの扁平率が下がります)`, cur: w.size === s }));
    if (k === 'offset') return WHEEL_OFFSETS.map(o => ({ html: `<div style="font-size:42px;font-style:italic;color:#222">${o > 0 ? '+' : ''}${o}</div><div class="cap">${o > 0 ? 'ツライチ寄り' : o < 0 ? 'インセット' : '標準'}</div>`, value: o, desc: `オフセット ${o > 0 ? '+' : ''}${o}(+で外側へ)`, cur: (w.offset || 0) === o }));
    if (k === 'tirew') return TIRE_WIDTHS.map(t => ({ html: `<div style="font-size:40px;font-style:italic;color:#222">${t >= 0 ? '+' : ''}${t}<small style="font-size:18px">mm</small></div><div class="cap">タイヤ幅</div>`, value: t, desc: `タイヤ幅 ${t >= 0 ? '+' : ''}${t}mm(太いほどグリップ↑・空気抵抗わずかに↑)`, cur: (this.draft.wheel.tireW || 0) === t }));
    if (k === 'tire') return TIRE_LOOKS.map(t => ({ html: `<div style="font-family:var(--jp);font-weight:900;font-size:26px;color:#222">${t.name}</div>`, value: t.id, desc: `タイヤの外観:${t.name}`, cur: this.draft.wheel.tire === t.id }));
    if (k === 'target') return [['both', '前後同じ'], ['f', 'フロント'], ['r', 'リア']].map(([v, nm]) => ({ html: `<div style="font-family:var(--jp);font-weight:900;font-size:30px;color:#222">${nm}</div>`, value: v, desc: `編集対象を「${nm}」にします(前後別々のホイールを設定できます)`, cur: this.target === v }));
    return [];
  },
  renderParts() {
    this.opts = this.options(); const eq = Math.max(0, this.opts.findIndex(o => o.cur));
    this.sel = { i: eq };
    this.mark = renderRow($('.hrow', this.el), this.opts, this.sel, eq, (i, click) => { this.sel.i = i; this.mark(); this.preview(); if (click) this.equip(); });
    $$('.hrow canvas', this.el).forEach((cv, i) => paintWheel(cv, this.opts[i].paint));
    $('.pdesc', this.el).textContent = this.opts[this.sel.i]?.desc || '';
  },
  set(val) {
    const k = WHEEL_CATS[this.ci].k; const W = this.draft.wheel;
    if (k === 'target') { this.target = val; W.link = val === 'both'; return; }
    if (k === 'tire') { W.tire = val; return; }
    if (k === 'tirew') { W.tireW = val; return; }
    const tgts = this.target === 'both' ? [W.f, W.r] : [this.target === 'r' ? W.r : W.f];
    for (const t of tgts) { t[k] = val; if (k === 'color' && !this._rimTouched) t.rim = val; }
    if (k === 'rim') this._rimTouched = true;
  },
  preview() { const o = this.opts[this.sel.i]; if (!o) return; if (WHEEL_CATS[this.ci].k !== 'target') { this.set(o.value); this.redraw(); } $('.pdesc', this.el).textContent = o.desc; },
  equip() {
    const o = this.opts[this.sel.i]; if (!o) return;
    if (o.locked) { Audio.ui('error'); return toast(o.locked); }
    this.set(o.value);
    this.gc.dress = JSON.parse(JSON.stringify(this.draft)); Save.touch('wheel'); Audio.ui('ok'); this.redraw();
    this.renderParts();
  },
  revert() { this.draft = JSON.parse(JSON.stringify(this.gc.dress)); this.redraw(); },
  async finish(timeout) {
    stopClock(); this.revert(); await Save.persistNow('wheel');
    if (timeout) toast('時間切れ — 装着中のホイールを保存しました');
    if (this.params.back === 'dressup') return UI.go('dressup', { uid: this.gc.uid, flow: this.params.flow, cat: DRESS_CATS.findIndex(c => c.k === 'wheel') });
    if (App.hubReturn) return UI.go(App.takeReturn());
    UI.go('garage', { menu: 2 });
  },
  onAction(a) {
    if (a === 'back') { Audio.ui('back'); return this.finish(false); }
    if (a === 'up' || a === 'down') { this.revert(); this.ci = (this.ci + (a === 'up' ? -1 : 1) + WHEEL_CATS.length) % WHEEL_CATS.length; Audio.ui('move'); this.layout(this.ci); return this.renderParts(); }
    if (a === 'left' || a === 'right') { const n = this.opts.length; this.sel.i = (this.sel.i + (a === 'left' ? -1 : 1) + n) % n; Audio.ui('move'); this.mark(); return this.preview(); }
    if (a === 'ok') this.equip();
  },
});

// ───────────────────────── METER CUSTOMIZE ─────────────────────────
const METER_CATS = [['design', 'メーター'], ['bg', '背景'], ['text', '文字色'], ['light', 'メーター照明']];
UI.register({
  id: 'meter',
  build(n) {
    n.innerHTML = `${backdrop([[660, 40], [1890, 40], [1890, 640], [560, 640]])}
      <div style="position:absolute;left:560px;top:40px;width:1330px;height:600px;z-index:1;clip-path:polygon(100px 0,100% 0,100% 100%,0 100%);background:radial-gradient(ellipse at 60% 50%,#2a4a8a,#0a1428 70%),repeating-linear-gradient(115deg,rgba(255,255,255,.05) 0 3px,transparent 3px 16px)"></div>
      ${titleTimer('METER CUSTOMIZE', 'mt-tm').replace('class="af-title"', 'class="af-title" style="left:780px;top:56px"')}
      <canvas class="mt-big" width="460" height="420" style="position:absolute;left:1220px;top:70px;width:540px;height:493px;z-index:3"></canvas>
      <div class="mt-name" style="position:absolute;left:1220px;top:572px;width:540px;text-align:center;z-index:4;font-family:var(--jp);font-weight:900;font-size:34px;text-shadow:0 3px 0 #000"></div>
      <div class="pp"></div>
      <div style="position:absolute;left:40px;top:230px;width:500px;z-index:5;padding:14px 20px;background:linear-gradient(180deg,#2a2e35,#111);border:3px solid #888;clip-path:polygon(0 0,100% 0,94% 100%,0 100%)">
        <div style="font-family:var(--jp);font-weight:900;font-size:22px;color:#ddd">現在使用中のメーター</div><canvas class="mt-cur" width="460" height="420" style="width:300px;height:274px;display:block;margin:6px auto"></canvas><div class="mt-curname" style="text-align:center;font-family:var(--jp);font-weight:900;font-size:24px"></div></div>
      <div class="mt-cats" style="position:absolute;left:600px;top:250px;z-index:5;display:flex;flex-direction:column;gap:10px"></div>
      <div class="hintbar" style="top:640px">メーターを選択してください</div>
      <div class="strip mt-strip" style="top:690px"></div>
      <div class="cbx"></div>${logoMark()}${keyGuide([['lr', '選択'], ['ud', '項目'], ['ok', '決定'], ['back', '戻る']])}`;
  },
  enter(params = {}) {
    const gc = Save.profile.cars.find(c => c.uid === params.uid) || Save.activeCar; normalizeCar(gc); this.gc = gc;
    this.spec = App.specOf(gc); this.draft = { ...gc.meter };
    App.gfx.setView(null);
    $('.pp', this.el).innerHTML = plate(); $('.cbx', this.el).innerHTML = consoleBox();
    this.ci = 0; this.renderCats(); this.renderStrip();
    this.t = 0; cancelAnimationFrame(this.raf);
    let last = performance.now();
    const loop = (now) => { this.t += (now - last) / 1000; last = now; this.drawPreviews(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    startClock($('#mt-tm'), 180, () => this.finish(true));
  },
  leave() { stopClock(); cancelAnimationFrame(this.raf); },
  renderCats() {
    $('.mt-cats', this.el).innerHTML = METER_CATS.map(([k, jp], i) => `<div style="padding:10px 30px;font-family:var(--jp);font-weight:900;font-size:24px;cursor:pointer;clip-path:polygon(10% 0,100% 0,90% 100%,0 100%);background:${i === this.ci ? 'linear-gradient(90deg,#ffd000,#ff8a00)' : 'rgba(20,22,26,.85)'};color:${i === this.ci ? '#111' : '#fff'}" data-i="${i}">${jp}</div>`).join('');
    $$('.mt-cats div', this.el).forEach(d => d.onclick = () => { this.ci = +d.dataset.i; Audio.ui('move'); this.renderCats(); this.renderStrip(); });
  },
  items() {
    const k = METER_CATS[this.ci][0];
    if (k === 'design') return METERS.map(m => ({ v: m.id, jp: m.jp, cv: true }));
    if (k === 'bg') return METER_BGS.map(([jp, v]) => ({ v, jp, cv: true }));
    if (k === 'text') return METER_TEXT.map(([jp, v]) => ({ v, jp, sw: v }));
    return METER_LIGHT.map(([jp, v]) => ({ v, jp, sw: v }));
  },
  renderStrip() {
    const k = METER_CATS[this.ci][0]; this.list = this.items();
    const strip = $('.mt-strip', this.el);
    strip.innerHTML = '<i class="mk l"></i>' + this.list.map(it => `<div class="scard" style="background:linear-gradient(180deg,#1a2a4a,#0a0e18)">${it.cv ? '<canvas width="460" height="420" style="inset:6px 50px 46px;width:calc(100% - 100px);height:calc(100% - 52px)"></canvas>' : `<div style="position:absolute;left:50%;top:22px;transform:translateX(-50%);width:90px;height:70px;border-radius:10px;border:4px solid #fff;background:${it.sw}"></div>`}<div class="lab" style="background:linear-gradient(90deg,#1a5ad0,#36c3ff)">${it.jp}</div>${this.gc.meter[k] === it.v ? '<div class="eq">装着中</div>' : ''}</div>`).join('') + '<i class="mk r"></i>';
    const cards = $$('.scard', strip);
    this.focus = new Focus(cards, { axis: 'h', index: Math.max(0, this.list.findIndex(it => it.v === this.draft[k])), onChange: (i) => { this.draft[k] = this.list[i].v; }, onSelect: (i) => this.equip(i) });
    const ap = this.focus.apply.bind(this.focus); this.focus.apply = () => { ap(); cards.forEach((c, j) => c.classList.toggle('sel', j === this.focus.i)); }; this.focus.apply();
    this.thumbs = $$('.scard canvas', strip);
    this.thumbs.forEach((cv, j) => { const it = this.list.filter(x => x.cv)[j]; const cfg = { ...this.draft, [k]: it.v }; drawMeter(cv.getContext('2d'), cfg.design, cfg, demoState(1.6, this.spec)); });
  },
  drawPreviews() {
    const st = demoState(this.t, this.spec);
    drawMeter($('.mt-big', this.el).getContext('2d'), this.draft.design, this.draft, st);
    drawMeter($('.mt-cur', this.el).getContext('2d'), this.gc.meter.design, this.gc.meter, st);
    $('.mt-name', this.el).textContent = METERS.find(m => m.id === this.draft.design).jp;
    $('.mt-curname', this.el).textContent = METERS.find(m => m.id === this.gc.meter.design).jp;
  },
  equip(i) {
    const k = METER_CATS[this.ci][0]; this.draft[k] = this.list[i].v;
    this.gc.meter = { ...this.draft }; Save.touch('meter'); Audio.ui('ok'); toast('メーター設定を保存しました(レース中のHUDに反映されます)');
    this.renderStrip();
  },
  async finish(timeout) { stopClock(); this.draft = { ...this.gc.meter }; await Save.persistNow('meter'); if (timeout) toast('時間切れ — 設定を保存しました'); if (App.hubReturn) return UI.go(App.takeReturn()); UI.go('garage', { menu: 3 }); },
  onAction(a) {
    if (a === 'back') { Audio.ui('back'); return this.finish(false); }
    if (a === 'up' || a === 'down') { this.draft = { ...this.gc.meter }; this.ci = (this.ci + (a === 'up' ? -1 : 1) + METER_CATS.length) % METER_CATS.length; Audio.ui('move'); this.renderCats(); return this.renderStrip(); }
    this.focus.action(a);
  },
});

// ───────────────────────── TUNING ─────────────────────────
const PART_ICON = { engine: '⚙', drivetrain: '⛓', suspension: '〽', brakes: '◎', body: '▣', tires: '◉' };
UI.register({
  id: 'tuning',
  build(n) {
    n.innerHTML = `<div class="rotzone" style="position:absolute;left:640px;right:640px;top:60px;bottom:440px;z-index:4"></div>
      ${backdrop([[700, 40], [1890, 40], [1890, 620], [600, 620]])}
      <div class="af-title" style="left:820px;top:52px"><div class="t">TUNING</div></div>
      <div class="bigtimer tn-big" style="font-size:120px"><b>3:00</b></div>
      <div class="pp"></div>
      <div class="tn-left" style="position:absolute;left:30px;top:220px;width:560px;z-index:5"></div>
      <div class="icard tn-right" style="right:40px;top:200px;width:520px"></div>
      <div class="hintbar" style="top:612px">チューニングポイントを消費してこのクルマの性能を上げます</div>
      <div class="tn-cats" style="position:absolute;left:0;right:0;top:664px;z-index:5;display:flex;justify-content:center;gap:8px"></div>
      <div class="strip tn-strip" style="top:700px"></div>
      <div style="position:absolute;left:50%;top:912px;transform:translateX(-50%);width:640px;height:64px;z-index:6;display:flex;align-items:center;background:#111;border:3px solid #888;border-radius:6px;font-size:30px;font-style:italic"><span style="padding:0 26px;background:linear-gradient(180deg,#f4f6f8,#9aa0a8);color:#111;height:100%;display:grid;place-items:center">Tune POINT</span><b class="tn-tp" style="flex:1;text-align:right;padding-right:26px"></b></div>
      <div class="cbx"></div>${logoMark()}${keyGuide([['lr', 'パーツ'], ['ud', 'カテゴリ'], ['ok', '強化'], ['back', '戻る']])}`;
  },
  enter(params = {}) {
    const gc = Save.profile.cars.find(c => c.uid === params.uid) || Save.activeCar; normalizeCar(gc); this.gc = gc;
    this.base = carById(gc.carId);
    App.gfx.setView(App.showroom); App.showroom.setWindow(0.55, 0.3, 0.85); App.showroom.setPreset('free'); App.showroom.setCar(App.specOf(gc), gc.dress);
    $('.pp', this.el).innerHTML = plate();
    this.ci = 0; this.render(0);
    const tm = $('.tn-big', this.el);
    if (!App.settings.custTimer) tm.classList.add('off'); else { tm.classList.remove('off'); startClock(tm, 180, () => this.finish(true)); }
  },
  leave() { stopClock(); },
  parts() { return TUNE_CATS[this.ci].parts.filter(p => !p.turboOnly || this.base.sound.turbo); },
  render(idx = 0) {
    $('.cbx', this.el).innerHTML = consoleBox();
    $('.tn-tp', this.el).textContent = `${Save.profile.tp ?? 0} pts.`;
    $('.tn-cats', this.el).innerHTML = TUNE_CATS.map((c, i) => `<b style="padding:4px 20px;font-size:18px;font-style:italic;cursor:pointer;clip-path:polygon(10% 0,100% 0,90% 100%,0 100%);background:${i === this.ci ? 'linear-gradient(90deg,#ffd000,#ff8a00)' : 'rgba(20,22,26,.85)'};color:${i === this.ci ? '#111' : '#ddd'}" data-i="${i}">${c.name}</b>`).join('');
    $$('.tn-cats b', this.el).forEach(b => b.onclick = () => { this.ci = +b.dataset.i; Audio.ui('move'); this.render(0); });
    const parts = this.parts();
    $('.tn-strip', this.el).innerHTML = '<i class="mk l"></i>' + parts.map(p => { const lv = this.gc.tune[p.id] || 0; return `<div class="scard" style="background:linear-gradient(180deg,#f4f6f8,#c8ccd2);height:170px"><div style="position:absolute;left:0;right:0;top:14px;text-align:center;font-size:54px;color:#444">${PART_ICON[TUNE_CATS[this.ci].id]}</div>
      <div class="lab" style="bottom:28px;background:linear-gradient(90deg,#1a5ad0,#36c3ff);font-size:20px">${p.jp}</div><div style="position:absolute;left:0;right:0;bottom:2px;text-align:center;font-size:18px;font-style:italic;color:#111">${lv >= TUNE_MAX ? 'MAX' : tuneCost(lv + 1) + ' pts.'}</div>
      <div style="position:absolute;right:34px;top:8px;font-size:15px;font-style:italic;color:#c00">Lv.${lv}</div></div>`; }).join('') + '<i class="mk r"></i>';
    const cards = $$('.tn-strip .scard', this.el);
    this.focus = new Focus(cards, { axis: 'h', index: Math.min(idx, cards.length - 1), onChange: (i) => this.info(i), onSelect: (i) => this.buy(i) });
    const ap = this.focus.apply.bind(this.focus); this.focus.apply = () => { ap(); cards.forEach((c, j) => c.classList.toggle('sel', j === this.focus.i)); }; this.focus.apply();
    this.info(this.focus.i);
  },
  info(i) {
    const p = this.parts()[i]; const lv = this.gc.tune[p.id] || 0;
    const cur = App.specOf(this.gc); const nt = { ...this.gc.tune, [p.id]: Math.min(TUNE_MAX, lv + 1) };
    const nxt = buildSpec(this.base, nt, this.gc.setup, this.gc.dress);
    const total = tuneTotal(this.gc.tune);
    const fxRows = [['パワー', 'power'], ['コーナリング', 'handling'], ['スタビリティ', 'stability']];
    $('.tn-left', this.el).innerHTML = `<div style="display:inline-block;padding:6px 30px;background:linear-gradient(180deg,#e8f4ff,#8ad0ff);color:#0a2a6a;border-radius:8px;font-size:34px;font-style:italic;box-shadow:0 4px 0 #000">Tune Lv.${total}→${lv >= TUNE_MAX ? total : total + 1}</div>
      <div style="margin-top:14px;padding:20px 24px;background:linear-gradient(180deg,#2a2e35,#111);border:3px solid #777;clip-path:polygon(0 0,100% 0,95% 100%,0 100%)">
        <div style="display:flex;align-items:center;gap:20px"><div style="width:110px;height:110px;display:grid;place-items:center;font-size:70px;background:#ddd;color:#333;border-radius:10px">${PART_ICON[TUNE_CATS[this.ci].id]}</div><div style="font-family:var(--jp);font-weight:900;font-size:36px">${p.jp}<div style="font-size:20px;color:#ffd400">Lv.${lv} / ${TUNE_MAX}</div></div></div>
        <div style="margin-top:14px;color:#fff">${segBars(fxRows, carStats(cur), carStats(nxt))}</div>
        <div style="margin-top:12px;font-family:var(--jp);font-weight:900;font-size:22px;color:#ddd">${esc(p.desc)}</div>
        <div style="margin-top:8px;font-size:18px;color:#aaa">${cur.engine.hp}PS → <b style="color:#3dff8a">${nxt.engine.hp}PS</b> · ${cur.mass}kg → <b style="color:#3dff8a">${nxt.mass}kg</b> · 必要 <b style="color:#ffd400">${lv >= TUNE_MAX ? '—' : tuneCost(lv + 1) + ' pts.'}</b></div></div>`;
    $('.tn-right', this.el).innerHTML = `<div style="display:flex;align-items:center;gap:10px;font-family:var(--jp);font-weight:900;font-size:16px;color:#666"><span style="font-size:26px">🔧</span>チューニングスタイル</div><div class="nm" style="font-family:var(--jp);font-weight:900;font-size:30px">${tuneStyle(total)}</div>
      <div style="font-size:16px;color:#555;margin:4px 0 10px">${esc(this.gc.name)} · ${tuneLevel(this.gc)}</div>${segBars(STAT6, carStats(cur), carStats(nxt))}`;
  },
  async buy(i) {
    const p = this.parts()[i]; const lv = this.gc.tune[p.id] || 0;
    if (lv >= TUNE_MAX) { Audio.ui('error'); return toast('これ以上強化できません'); }
    const cost = tuneCost(lv + 1); const tp = Save.profile.tp ?? 0;
    if (cost > tp) { Audio.ui('error'); return dialog.alert('ポイント不足', `${p.jp} Lv.${lv + 1} には ${cost} pts. 必要です(所持 ${tp} pts.)<br>レース完走・タイムアタック・イベントで獲得できます。`); }
    if (!(await dialog.confirm('チューニング', `${p.jp} を Lv.${lv + 1} に強化しますか?<br>消費:${cost} pts.`, '強化する', 'やめる'))) return;
    Save.profile.tp = tp - cost; this.gc.tune[p.id] = lv + 1; this.gc.hp = App.specOf(this.gc).engine.hp;
    await Save.persistNow('tune'); Audio.ui('coin'); toast(`${p.jp} Lv.${lv + 1}!`);
    this.render(i);
  },
  async finish(timeout) { stopClock(); await Save.persistNow('tune'); if (timeout) toast('時間切れ — 保存しました'); if (App.hubReturn) return UI.go(App.takeReturn()); UI.go('garage', { menu: 4 }); },
  onAction(a) {
    if (a === 'back') { Audio.ui('back'); return this.finish(false); }
    if (a === 'up' || a === 'down') { this.ci = (this.ci + (a === 'up' ? -1 : 1) + TUNE_CATS.length) % TUNE_CATS.length; Audio.ui('move'); return this.render(0); }
    this.focus.action(a);
  },
});

// ───────────────────────── COURSE SELECT ─────────────────────────
const CPU_LV = [{ id: 'easy', name: 'EASY', skill: 0.82, aggr: 0.2, reward: 400 }, { id: 'normal', name: 'NORMAL', skill: 0.9, aggr: 0.45, reward: 700 }, { id: 'hard', name: 'HARD', skill: 0.97, aggr: 0.75, reward: 1100 }, { id: 'legend', name: 'LEGEND', skill: 1.02, aggr: 1.0, reward: 1600 }];
const BGMS = [['race', 'Night Touge Rush'], ['title', 'Midnight Ridge'], ['menu', 'Garage Groove'], ['result', 'Victory Lane']];
const GUIDE = { akane: '連続ヘアピンは進入で無理せず、立ち上がり重視でね。トンネル出口の左は思ったより深いよ。', shiranami: '高速コーナーが続くから、ブレーキよりアクセルワークでラインを整えるのがコツ!', ryusei: '雨の日は早めの減速が大事。水たまりの多いヘアピンは特に慎重に。', kasumi: '長い直線のあとに5連続ヘアピン!ブレーキは早めに、側溝に気をつけてね。' };
UI.register({
  id: 'course',
  build(n) {
    n.innerHTML = `${backdrop([[700, 40], [1890, 40], [1890, 640], [600, 640]], { tone: '#cfd4dc' })}
      <canvas class="c-map" width="760" height="520" style="position:absolute;left:640px;top:70px;width:640px;height:440px;z-index:3"></canvas>
      <div class="c-label" style="position:absolute;left:820px;top:462px;z-index:4"></div>
      <div class="af-title" style="left:820px;top:52px"><div class="t">COURSE SELECT</div></div>
      <div class="bigtimer c-tm"><b>60</b></div>
      <div class="pp"></div>
      <div class="c-cars" style="position:absolute;left:20px;top:220px;width:580px;z-index:5;display:flex;flex-direction:column;gap:8px"></div>
      <div class="c-right" style="position:absolute;right:30px;top:150px;width:560px;z-index:5"></div>
      <div class="c-optbox" style="position:absolute;left:20px;top:452px;width:560px;z-index:5"></div>
      <div class="hintbar" style="top:640px">コースを選んでください</div>
      <div class="strip c-strip" style="top:690px"></div>
      <div class="c-navi" style="position:absolute;left:50%;top:900px;transform:translateX(-50%);width:620px;height:90px;z-index:6;display:flex;align-items:center;gap:16px;padding:0 20px;background:linear-gradient(180deg,#2a2e35,#0d0f12);border:3px solid #777;border-radius:10px"></div>
      <div class="cbx"></div>${logoMark()}${keyGuide([['lr', 'コース'], ['ud', 'オプション'], ['ok', '決定'], ['back', '戻る']])}`;
  },
  enter() {
    const P = App.pending; this.p = P;
    $('.pp', this.el).innerHTML = plate(); $('.cbx', this.el).innerHTML = consoleBox();
    this.tracks = {};
    const strip = $('.c-strip', this.el);
    strip.innerHTML = '<i class="mk l"></i>' + COURSES.map(c => { const locked = !Save.profile.unlocked.courses.includes(c.id); return `<div class="scard" style="background:${c.time === 'dusk' ? 'linear-gradient(180deg,#5a2a4a,#c06a3a)' : 'linear-gradient(180deg,#0a1430,#1a2a5a)'}"><canvas width="460" height="280" style="inset:4px 40px 46px;width:calc(100% - 80px);height:calc(100% - 50px)"></canvas><div class="lab" style="background:rgba(0,0,0,.55)">${c.jp}</div><div style="position:absolute;left:34px;top:6px;font-family:var(--jp);font-weight:900;font-size:15px;color:#ffd400">${['', '初級', '中級', '上級', '最上級', '伝説'][c.difficulty]}</div>${locked ? '<div class="tag" style="top:40px;background:#444;color:#ffd400">🔒 LOCKED</div>' : ''}</div>`; }).join('') + '<i class="mk r"></i>';
    $$('.c-strip canvas', this.el).forEach((cv, k) => drawCourseMap(cv, this.track(COURSES[k].id, 'fwd'), { w: 6 }));
    const cards = $$('.c-strip .scard', this.el);
    const idx = Math.max(0, COURSES.findIndex(c => c.id === P.courseId));
    this.zone = 'list'; this.optI = 0;
    this.focus = new Focus(cards, { axis: 'h', index: idx, onChange: (i) => { P.courseId = COURSES[i].id; P.dir = 'fwd'; P.weather = null; P.time = null; this.show(); }, onSelect: () => this.go() });
    const ap = this.focus.apply.bind(this.focus); this.focus.apply = () => { ap(); cards.forEach((c, j) => c.classList.toggle('sel', j === this.focus.i)); }; this.focus.apply();
    P.courseId = COURSES[idx].id; P.cpu ||= 'normal';
    this.show();
    bigTimer($('.c-tm', this.el), 60, () => this.go(true));
  },
  leave() { stopTimer(); clearTimeout(this._pv); },
  track(id, dir) { const k = id + dir; return this.tracks[k] ||= new Track(courseById(id), dir); },
  show() {
    const P = this.p; const c = courseById(P.courseId); const tr = this.track(c.id, P.dir);
    const weather = P.weather || c.weather, time = P.time || c.time;
    // live 3D flyover of the course behind the UI (built lazily)
    clearTimeout(this._pv);
    this._pv = setTimeout(() => { if (UI.current !== this) return; App.coursePreview ||= new CoursePreview(App.gfx); App.coursePreview.show(c.id, P.dir, weather, time); App.gfx.setView(App.coursePreview); }, 250);
    drawCourseMap($('.c-map', this.el), tr, { w: 7, color: '#ff4af0', glow: 'rgba(255,60,230,.45)' });
    $('.c-label', this.el).innerHTML = `<div style="display:inline-block;padding:4px 22px;border:3px solid #ff4af0;background:rgba(40,0,40,.75);font-family:var(--jp);font-weight:900;font-size:24px;color:#fff;box-shadow:0 0 16px #f4f">${c.features[0]}</div><div style="font-size:64px;line-height:70px;font-style:italic;text-shadow:0 5px 0 #000">${c.name}</div><div style="font-family:var(--jp);font-weight:900;font-size:30px;color:#ffd400;text-shadow:0 3px 0 #000">${c.jp} — ${c.dirs[P.dir][1]}</div>`;
    // left: cars (active glowing)
    const p = Save.profile;
    $('.c-cars', this.el).innerHTML = p.cars.slice(0, 2).map(gc => { const on = gc.uid === p.activeCar; const b = carById(gc.carId); return `<div style="height:96px;display:flex;align-items:center;gap:14px;padding:0 40px 0 16px;background:${on ? 'linear-gradient(90deg,#fff,#f0e0ff)' : 'rgba(60,60,66,.75)'};clip-path:polygon(0 0,100% 0,95% 100%,0 100%);${on ? 'box-shadow:inset 0 0 0 4px #d040ff;filter:drop-shadow(0 0 12px #d040ff)' : ''};color:${on ? '#111' : '#ccc'}"><img src="${carThumb(gc.carId, gc.dress)}" style="width:130px;height:74px;object-fit:contain"><div style="flex:1;min-width:0"><div style="font-size:22px;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(gc.name)}</div><div class="chipr">${attrChips(b)}<span style="margin-left:auto;font-size:16px">${tuneLevel(gc)}</span></div></div></div>`; }).join('')
      + (p.cars.length < 2 ? `<div style="height:70px;display:grid;place-items:center;background:rgba(60,60,66,.6);clip-path:polygon(0 0,100% 0,95% 100%,0 100%);font-family:var(--jp);font-weight:900;font-size:18px;color:#ccc">ガレージで車両を追加登録できます</div>` : '')
      + `<div style="font-family:var(--jp);font-weight:900;font-size:16px;color:#333">※ 使用車両の変更はガレージで行えます</div>`;
    // right: reputation + guide + options
    const recF = p.records[`${c.id}:fwd`], recR = p.records[`${c.id}:rev`];
    const lvOf = (r) => r ? Math.max(1, Math.min(9, Math.round(10 - r.best / 30))) : 0;
    const opts = [['DIRECTION', `${c.dirs[P.dir][1]}(${c.dirs[P.dir][0]})`], ['WEATHER', weather === 'rain' ? '雨 (WET)' : '晴れ (DRY)'], ['TIME', TIME_LBL[time]]];
    if (P.mode === 'battle') opts.push(['CPU LEVEL', CPU_LV.find(l => l.id === P.cpu).name]);
    if (P.event) opts.length = 0;
    $('.c-right', this.el).innerHTML = `<div style="background:linear-gradient(180deg,rgba(20,40,110,.9),rgba(8,14,40,.9));border:2px solid #6a8ad0;padding:14px 20px;font-family:var(--jp);font-weight:900">
        <div style="display:flex;align-items:center;gap:10px;font-size:18px;color:#9cf">あなたの評判<span style="margin-left:auto;padding:2px 14px;background:#fff;color:#111;font-size:22px">${recF || recR ? (lvOf(recF) + lvOf(recR) > 10 ? '峠の実力者' : '走り屋') : '通行人'}</span></div>
        <div style="display:grid;grid-template-columns:150px 1fr 1fr;gap:2px 10px;margin-top:8px;font-size:20px">
          <span>${c.dirs.fwd[1]}</span><span style="color:#ffd400">Lv.${lvOf(recF)}</span><span>${recF ? fmt(recF.best) : '記録なし'}</span>
          <span>${c.dirs.rev[1]}</span><span style="color:#ffd400">Lv.${lvOf(recR)}</span><span>${recR ? fmt(recR.best) : '記録なし'}</span></div>
        <div style="display:flex;gap:12px;margin-top:12px;align-items:flex-start"><div style="flex:none;border:3px solid #fff;border-radius:8px;overflow:hidden">${avatarSVG(6, 74)}</div><div style="font-size:19px;line-height:30px;background:rgba(0,0,0,.35);padding:6px 12px;border-radius:6px"><span style="color:#ff9a40">ナビ ミナミ</span><br>${GUIDE[c.id] || ''}</div></div>
        <div style="margin-top:8px;font-size:18px;color:#ccc">全長 ${(tr.length * (tr.closed ? c.laps : 1) / 1000).toFixed(2)}km · 高低差 ${Math.round(tr.bounds.maxY - tr.bounds.minY)}m · 難易度 <span style="color:#ffd400">${'★'.repeat(c.difficulty)}</span><br>解放条件:<span style="color:${!Save.profile.unlocked.courses.includes(c.id) ? '#ff6a6a' : '#3dff8a'}">${c.unlock ? (!Save.profile.unlocked.courses.includes(c.id) ? c.unlock.text : '解放済み') : '最初から解放'}</span></div></div>
`;
    $('.c-optbox', this.el).innerHTML = `<div class="c-opts" style="display:flex;flex-direction:column;gap:8px">${opts.map(([l, v]) => `<div class="opt" style="height:56px"><label style="width:170px">${l}</label><span class="arr">◀</span><span class="val" style="font-family:var(--jp);font-weight:900;font-size:22px">${v}</span><span class="arr">▶</span></div>`).join('')}</div>`;
    $$('.c-opts .opt', this.el).forEach((o, k) => { o.onclick = (e) => { this.optI = k; this.zone = 'opt'; this.changeOpt(e.offsetX < o.clientWidth / 2 ? -1 : 1); }; });
    this.hlOpt();
    const bg = App.settings.raceBgm || 'race'; const bi = BGMS.findIndex(b => b[0] === bg);
    $('.c-navi', this.el).innerHTML = `<div style="font-size:14px;color:#9cf;font-style:italic;writing-mode:vertical-rl">R-Navi</div><div style="flex:1;height:60px;background:#0a1a10;border:2px solid #2a4a2a;border-radius:4px;padding:4px 14px;font-family:'Courier New',monospace;color:#7dff8a"><div style="font-size:14px">#0${bi + 1} BGM</div><div style="font-size:24px;font-weight:bold;white-space:nowrap;overflow:hidden">${BGMS[bi][1]}</div></div><button class="btn small dark c-bgm" style="min-width:120px;height:56px;font-size:18px">BGM変更</button>`;
    $('.c-bgm', this.el).onclick = () => { const s = App.settings; const i = (BGMS.findIndex(b => b[0] === (s.raceBgm || 'race')) + 1) % BGMS.length; s.raceBgm = BGMS[i][0]; Save.touch('settings'); Audio.ui('move'); this.show(); };
  },
  hlOpt() { $$('.c-opts .opt', this.el).forEach((o, k) => o.classList.toggle('focus', this.zone === 'opt' && k === this.optI)); },
  changeOpt(d) {
    const P = this.p; const c = courseById(P.courseId);
    if (this.optI === 0) P.dir = P.dir === 'fwd' ? 'rev' : 'fwd';
    else if (this.optI === 1) P.weather = (P.weather || c.weather) === 'rain' ? 'clear' : 'rain';
    else if (this.optI === 2) { const T = ['night', 'dusk', 'day']; P.time = T[(T.indexOf(P.time || c.time) + d + 3) % 3]; }
    else { const i = CPU_LV.findIndex(l => l.id === P.cpu); P.cpu = CPU_LV[(i + d + CPU_LV.length) % CPU_LV.length].id; }
    Audio.ui('move'); this.show();
  },
  async go(timeout) {
    const P = this.p; const c = courseById(P.courseId);
    if (!Save.profile.unlocked.courses.includes(c.id)) {
      Audio.ui('error');
      if (timeout) { P.courseId = COURSES[0].id; } else { await dialog.alert('LOCKED', `${c.jp} は未解放です。<br>${c.unlock.text}`); return; }
    }
    stopTimer(); Audio.ui('start');
    UI.go('race', { mode: P.mode, courseId: P.courseId, dir: P.dir, weather: P.weather || courseById(P.courseId).weather, time: P.time || courseById(P.courseId).time, cpu: CPU_LV.find(l => l.id === P.cpu), event: P.event });
  },
  onAction(a) {
    if (a === 'back') { Audio.ui('back'); return UI.go(this.p.event ? 'special' : 'mode'); }
    const nOpt = $$('.c-opts .opt', this.el).length;
    if (a === 'up' && nOpt) { if (this.zone === 'list') { this.zone = 'opt'; this.optI = nOpt - 1; } else this.optI = Math.max(0, this.optI - 1); Audio.ui('move'); return this.hlOpt(); }
    if (a === 'down' && this.zone === 'opt') { if (this.optI < nOpt - 1) this.optI++; else this.zone = 'list'; Audio.ui('move'); return this.hlOpt(); }
    if (this.zone === 'opt' && (a === 'left' || a === 'right')) return this.changeOpt(a === 'left' ? -1 : 1);
    if (a === 'ok') return this.go();
    if (this.p.event) return;
    this.focus.action(a);
  },
});

// ───────────────────────── IN-STORE (parts shop) ─────────────────────────
const STORE_CATS = [
  ...Object.entries(AERO).map(([k, v]) => ({ k, jp: v.jp, icon: v.icon, band: v.band, list: v.list.filter(it => it.id !== 0 && it.id !== 'stock').map(it => ({ id: it.id, brand: it.brand, name: it.name })) })),
  { k: 'wheel', jp: 'ホイール', icon: 'wheel', band: '#1a7ad0', list: WHEEL_DESIGNS.filter(d => d.brand).map(d => ({ id: d.id, brand: d.brand, name: d.name })) },
  { k: 'vinyl', jp: 'ステッカー', icon: 'vinyl', band: '#e06a00', list: [...new Set(Object.values(VINYL_SLOTS).flatMap(v => v.designs))].filter(d => d !== 'none').map(d => ({ id: d, brand: 'NORMAL', name: VINYL_NAMES[d] })) },
];
UI.register({
  id: 'store',
  build(n) {
    n.innerHTML = `<div class="rotzone" style="position:absolute;left:620px;right:40px;top:40px;bottom:400px;z-index:4"></div>
      ${backdrop([[640, 40], [1890, 40], [1890, 690], [520, 690]], { tone: '#d8c8a8' })}
      <div class="af-title" style="left:760px;top:56px"><div class="t">IN-STORE</div><div style="font-family:var(--jp);font-weight:900;font-size:24px;color:#ffd400;text-shadow:0 2px 0 #000">パーツショップ — 購入したパーツは全車種で使えます</div></div>
      <div class="pp"></div><div class="vcat"></div>
      <div style="position:absolute;left:520px;right:0;top:700px;height:300px;overflow:hidden;z-index:5"><div class="hrow" style="left:40px;top:60px;right:auto"></div></div>
      <div class="pdesc"></div><div class="st-buy" style="position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);z-index:20;pointer-events:none"></div>
      <div class="cbx"></div>${logoMark()}${keyGuide([['ud', 'カテゴリ'], ['lr', '商品'], ['ok', '購入'], ['back', '戻る']])}`;
  },
  enter(params = {}) {
    const gc = Save.profile.cars.find(c => c.uid === params.uid) || Save.activeCar; normalizeCar(gc); this.gc = gc; this.base = carById(gc.carId);
    this.spec = App.specOf(gc);
    App.gfx.setView(App.showroom); App.showroom.setWindow(0.64, 0.33, 1.0); App.showroom.setPreset('three');
    $('.pp', this.el).innerHTML = plate();
    this.ci = 0;
    this.layout = renderVcat($('.vcat', this.el), STORE_CATS, 0, (i) => { this.ci = i; Audio.ui('move'); this.layout(i); this.render(); });
    this.render();
  },
  leave() { App.showroom.setPreset('free'); },
  render() {
    $('.cbx', this.el).innerHTML = consoleBox();
    const cat = STORE_CATS[this.ci];
    this.opts = cat.list.map(it => {
      const owned = Save.owns(cat.k, it.id), price = partPrice(cat.k, it.id);
      const inner = cat.k === 'wheel' ? `<canvas width="200" height="200" style="width:96px;height:96px"></canvas><div class="cap">${WHEEL_BRANDS[it.brand].name}</div>` : cat.k === 'vinyl' ? `<div style="font-family:var(--jp);font-weight:900;font-size:26px;color:#222">${esc(it.name)}</div>` : brandMark(it.brand);
      return { it, owned, price, html: `${inner}<div style="position:absolute;right:30px;bottom:8px;font-size:18px;font-style:italic;color:${owned ? '#1a8a3a' : '#c60'}">${owned ? '購入済み' : '¥' + price.toLocaleString()}</div>` };
    });
    this.sel = { i: 0 };
    this.mark = renderRow($('.hrow', this.el), this.opts, this.sel, -1, (i, click) => { this.sel.i = i; this.mark(); this.preview(); if (click) this.buy(); });
    $$('.hrow canvas', this.el).forEach((cv, i) => paintWheel(cv, { design: this.opts[i].it.id, color: '#c9ccd0', size: 17 }));
    this.preview();
  },
  preview() {
    const cat = STORE_CATS[this.ci], o = this.opts[this.sel.i]; if (!o) return;
    const d = JSON.parse(JSON.stringify(this.gc.dress));
    if (AERO[cat.k]) { if (cat.k === 'muffler') d.muffler = o.it.id; else d.aero[cat.k] = o.it.id; }
    if (cat.k === 'wheel') { d.wheel.f.design = d.wheel.r.design = o.it.id; }
    if (cat.k === 'vinyl') { const slot = Object.keys(VINYL_SLOTS).find(sl => VINYL_SLOTS[sl].designs.includes(o.it.id)); d.vinyl[slot].d = o.it.id; }
    App.showroom.setCar(buildSpec(this.base, this.gc.tune, this.gc.setup, d), d, { teamName: Save.profile.teamName });
    const before = carStats(this.spec), after = carStats(buildSpec(this.base, this.gc.tune, this.gc.setup, d));
    const diff = STAT6.map(([l, k]) => [l, after[k] - before[k]]).filter(([, v]) => Math.abs(v) > 0.02).map(([l, v]) => `${l} ${v > 0 ? '▲' : '▼'}${Math.abs(v).toFixed(2)}`).join(' / ');
    const fit = AERO[cat.k] ? (!isCompatible(this.base.body.style, cat.k, o.it.id) ? ' ※この車種には装着不可' : (AERO[cat.k].turboOnly && !this.base.sound.turbo ? ' ※ターボ車専用' : '')) : '';
    $('.pdesc', this.el).textContent = `${o.it.name}${diff ? ' — ' + diff : ''}${fit}`;
  },
  async buy() {
    const cat = STORE_CATS[this.ci], o = this.opts[this.sel.i]; if (!o) return;
    if (o.owned) { Audio.ui('error'); return toast('購入済みです'); }
    if (o.price > Save.profile.credits) { Audio.ui('error'); return dialog.alert('クレジット不足', `必要: ¥${o.price.toLocaleString()} / 所持: ¥${Save.profile.credits.toLocaleString()}`); }
    if (!(await dialog.confirm('購入確認', `<b>${esc(o.it.name)}</b><br>¥${o.price.toLocaleString()} で購入しますか?`, '購入する', 'やめる'))) return;
    Save.profile.credits -= o.price; Save.profile.inventory[`${cat.k}:${o.it.id}`] = true;
    await Save.persistNow('purchase');
    Audio.ui('coin'); setTimeout(() => Audio.ui('start'), 150);
    const fx = $('.st-buy', this.el);
    fx.innerHTML = `<div class="buyfx"><b>PURCHASED!</b><span>${esc(o.it.name)}</span><i>-¥${o.price.toLocaleString()}</i></div>`;
    setTimeout(() => { fx.innerHTML = ''; }, 1600);
    const i = this.sel.i; this.render(); this.sel.i = i; this.mark(); this.preview();
  },
  onAction(a) {
    if (a === 'back') { Audio.ui('back'); if (App.hubReturn) return UI.go(App.takeReturn()); return UI.go('garage', { menu: 5 }); }
    if (a === 'up' || a === 'down') { this.ci = (this.ci + (a === 'up' ? -1 : 1) + STORE_CATS.length) % STORE_CATS.length; Audio.ui('move'); this.layout(this.ci); return this.render(); }
    if (a === 'left' || a === 'right') { const n = this.opts.length; this.sel.i = (this.sel.i + (a === 'left' ? -1 : 1) + n) % n; Audio.ui('move'); this.mark(); return this.preview(); }
    if (a === 'ok') return this.buy();
  },
});
