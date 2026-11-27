// Reference-style hub menus: START MENU / SHOP & CUSTOMIZE / SHOP / CONFIG & PLAY DATA / UPDATE LOG
import { UI, $, $$, esc, dialog, toast, startTimer, stopTimer } from './core.js';
import { backdrop, plate, consoleBox, logoMark, keyGuide } from './frame.js';
import { carThumb, tuneLevel } from './screens-menu.js';
import { App, VERSION } from '../app.js';
import { Audio } from '../audio/audio.js';
import { Save } from '../core/save.js';
import { carById } from '../data/cars.js';
import { UPDATES, LATEST } from '../data/updates.js';
import { LotScene } from '../game/gfx.js';
import { devEnabled, devAllowed, setDevMode } from './screens-dev.js';

// ---- card artwork (original vector illustrations) ------------------------------------------
const ART = {
  shop: `<rect width="300" height="120" fill="url(#g1)"/><path d="M40 92 L60 40 L240 40 L262 92Z" fill="#1b1c20"/><rect x="58" y="44" width="186" height="16" fill="#111"/><text x="150" y="57" text-anchor="middle" font-family="Arial Black" font-style="italic" font-size="12" fill="#fff">REV GARAGE</text><rect x="70" y="62" width="70" height="30" fill="#2a3644"/><rect x="160" y="62" width="70" height="30" fill="#a8acb2"/><path d="M80 112 C82 98 96 92 120 90 L180 88 C206 88 220 98 222 112Z" fill="#e8e8e6" stroke="#222" stroke-width="2"/><path d="M118 92 L134 80 L168 80 L182 90Z" fill="#344052"/><circle cx="130" cy="112" r="9" fill="#111"/><circle cx="196" cy="112" r="9" fill="#111"/>`,
  mode: `<rect width="300" height="120" fill="url(#g2)"/><path d="M110 120 L146 30 L154 30 L190 120Z" fill="#2a2c30"/><path d="M149 40 L151 40 L153 120 L147 120Z" fill="#ffd400"/><path d="M96 100 C98 86 112 80 150 80 C188 80 202 86 204 100 L204 112 L96 112Z" fill="#f2f2ef" stroke="#222" stroke-width="2"/><rect x="104" y="94" width="26" height="7" fill="#e01010"/><rect x="170" y="94" width="26" height="7" fill="#e01010"/><path d="M118 82 L132 66 L168 66 L182 82Z" fill="#3a4658"/>`,
  config: `<rect width="300" height="120" fill="url(#g3)"/><g transform="translate(100 62)"><circle r="30" fill="none" stroke="#fff" stroke-width="12" stroke-dasharray="11 8"/><circle r="14" fill="#fff"/></g><rect x="170" y="70" width="14" height="34" fill="#ffd400"/><rect x="190" y="52" width="14" height="52" fill="#36c3ff"/><rect x="210" y="36" width="14" height="68" fill="#fff"/>`,
  team: `<rect width="300" height="120" fill="url(#g4)"/><path d="M100 110 V24" stroke="#ddd" stroke-width="4"/><path d="M100 24 C130 14 150 40 196 26 L196 64 C150 78 130 52 100 62Z" fill="#ffd400" stroke="#222" stroke-width="2"/><text x="148" y="52" text-anchor="middle" font-family="Arial Black" font-size="16" fill="#222">TEAM</text>`,
  custom: `<rect width="300" height="120" fill="url(#g3)"/><path d="M70 96 C72 80 88 72 120 70 L190 68 C214 68 228 78 230 96Z" fill="#f2f2ef" stroke="#222" stroke-width="2"/><path d="M118 72 L136 56 L180 56 L196 70Z" fill="#344052"/><circle cx="110" cy="98" r="12" fill="#111"/><circle cx="110" cy="98" r="6" fill="#ccc"/><circle cx="200" cy="98" r="12" fill="#111"/><circle cx="200" cy="98" r="6" fill="#ccc"/><path d="M222 20 L250 48 L242 56 L214 28Z" fill="#ffd400" stroke="#222" stroke-width="2"/><circle cx="214" cy="24" r="10" fill="none" stroke="#ffd400" stroke-width="6"/>`,
  online: `<rect width="300" height="120" fill="url(#g5)"/><circle cx="150" cy="60" r="40" fill="none" stroke="#fff" stroke-width="4"/><ellipse cx="150" cy="60" rx="18" ry="40" fill="none" stroke="#fff" stroke-width="3"/><path d="M110 60 H190 M116 40 H184 M116 80 H184" stroke="#fff" stroke-width="3"/><text x="150" y="112" text-anchor="middle" font-family="Arial Black" font-style="italic" font-size="14" fill="#36c3ff">ONLINE</text>`,
  news: `<rect width="300" height="120" fill="url(#g6)"/><rect x="96" y="24" width="108" height="78" rx="6" fill="#f4f4f0" stroke="#222" stroke-width="2"/><rect x="106" y="34" width="88" height="14" fill="#ff7a00"/><path d="M106 58 H194 M106 68 H194 M106 78 H170 M106 88 H184" stroke="#555" stroke-width="4"/><text x="214" y="34" font-family="Arial Black" font-style="italic" font-size="18" fill="#ffd400">NEW</text>`,
};
const GRADS = `<defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fc0ee"/><stop offset="1" stop-color="#4a6a52"/></linearGradient><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2440"/><stop offset="1" stop-color="#5a3a2a"/></linearGradient><linearGradient id="g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a6ad0"/><stop offset="1" stop-color="#0a2050"/></linearGradient><linearGradient id="g4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6aa02a"/><stop offset="1" stop-color="#1a3a0a"/></linearGradient><linearGradient id="g5" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a5aa0"/><stop offset="1" stop-color="#02142a"/></linearGradient><linearGradient id="g6" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6a3aa0"/><stop offset="1" stop-color="#1a0a30"/></linearGradient></defs>`;
const artSVG = (k) => `<svg viewBox="0 0 300 120" preserveAspectRatio="xMidYMid slice" class="art">${GRADS}${ART[k] || ''}</svg>`;

// orange glyph icons for the SHOP row
const GLYPH = {
  car: '<path d="M8 50 L16 34 L38 30 L50 18 L82 18 L94 32 L108 36 L110 50 Z" fill="#ff8a00" stroke="#3a1a00" stroke-width="3" stroke-linejoin="round"/><path d="M54 22 L80 22 L88 31 L46 32Z" fill="#3a1a00" opacity=".55"/><circle cx="32" cy="52" r="9" fill="#3a1a00"/><circle cx="88" cy="52" r="9" fill="#3a1a00"/>',
  tune: '<circle cx="46" cy="38" r="24" fill="none" stroke="#ff8a00" stroke-width="9"/><circle cx="46" cy="38" r="8" fill="#ff8a00"/><path d="M70 60 L100 22 L108 28 L80 66Z" fill="#ff8a00" stroke="#3a1a00" stroke-width="2"/><circle cx="104" cy="22" r="9" fill="none" stroke="#ff8a00" stroke-width="6"/>',
  dress: '<path d="M30 14 L48 8 C52 16 68 16 72 8 L90 14 L104 34 L90 42 L86 34 L86 66 L34 66 L34 34 L30 42 L16 34Z" fill="#ff8a00" stroke="#3a1a00" stroke-width="3" stroke-linejoin="round"/><circle cx="60" cy="40" r="10" fill="#3a1a00" opacity=".5"/>',
  avatar: '<circle cx="60" cy="24" r="16" fill="#ff8a00" stroke="#3a1a00" stroke-width="3"/><path d="M26 68 C28 46 42 40 60 40 C78 40 92 46 94 68Z" fill="#ff8a00" stroke="#3a1a00" stroke-width="3"/>',
  back: '<path d="M70 14 L30 38 L70 62 L70 48 C88 48 98 54 104 64 C102 42 90 30 70 28Z" fill="#ff8a00" stroke="#3a1a00" stroke-width="3" stroke-linejoin="round"/>',
  mode: '<path d="M20 64 L50 12 L70 12 L100 64Z" fill="#ff8a00" stroke="#3a1a00" stroke-width="3"/><path d="M58 18 L62 18 L64 60 L56 60Z" fill="#3a1a00"/>',
  parts: '<rect x="18" y="26" width="84" height="40" rx="4" fill="#ff8a00" stroke="#3a1a00" stroke-width="3"/><path d="M42 26 V16 H78 V26" fill="none" stroke="#ff8a00" stroke-width="7"/><path d="M18 42 H102" stroke="#3a1a00" stroke-width="3"/>',
  wheel: '<circle cx="60" cy="38" r="28" fill="#3a1a00" stroke="#ff8a00" stroke-width="7"/><circle cx="60" cy="38" r="16" fill="none" stroke="#ff8a00" stroke-width="4"/><path d="M60 22 V54 M44 38 H76 M49 27 L71 49 M71 27 L49 49" stroke="#ff8a00" stroke-width="4"/>',
  cup: '<path d="M30 30 H90 L84 70 H36Z" fill="#ff8a00" stroke="#3a1a00" stroke-width="3"/><ellipse cx="60" cy="30" rx="30" ry="8" fill="#ffb050" stroke="#3a1a00" stroke-width="3"/><ellipse cx="60" cy="32" rx="24" ry="5" fill="#3a1a00"/><path d="M24 8 C30 16 20 20 26 26 M60 4 C66 12 56 16 62 22" stroke="#ff8a00" stroke-width="4" fill="none"/>',
  meter: '<path d="M18 58 A42 42 0 1 1 102 58" fill="none" stroke="#ff8a00" stroke-width="9"/><path d="M60 54 L86 28" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="60" cy="54" r="7" fill="#ff8a00"/>',
  settings: '<g transform="translate(60 38)"><circle r="22" fill="none" stroke="#ff8a00" stroke-width="10" stroke-dasharray="9 7"/><circle r="9" fill="#ff8a00"/></g>',
  data: '<rect x="22" y="40" width="16" height="26" fill="#ff8a00"/><rect x="46" y="26" width="16" height="40" fill="#ff8a00"/><rect x="70" y="12" width="16" height="54" fill="#ff8a00"/><path d="M14 66 H100" stroke="#3a1a00" stroke-width="3"/>',
  news: '<rect x="22" y="10" width="76" height="58" rx="5" fill="#ff8a00" stroke="#3a1a00" stroke-width="3"/><path d="M32 26 H88 M32 38 H88 M32 50 H70" stroke="#3a1a00" stroke-width="5"/>',
};
const glyphSVG = (k) => `<svg viewBox="0 0 120 76" class="gl">${GLYPH[k] || ''}</svg>`;

// left column: the player's first three registered cars
function carList3() {
  const p = Save.profile; if (!p) return '';
  return `<div class="hb-cars">${p.cars.slice(0, 3).map(c => { const b = carById(c.carId); const on = c.uid === p.activeCar; return `<div class="hb-car${on ? ' on' : ''}"><img src="${carThumb(c.carId, c.dress)}"><div class="tx"><div class="nm">${esc(c.name)}</div><div class="sub"><span class="ch" style="background:${{ FR: '#d01020', FF: '#1a7ad0', '4WD': '#2a9a3a' }[b.drive]}">${b.drive}</span><span class="ch" style="background:#7a1aa0">${b.engine.type}</span><span class="lv">${tuneLevel(c)}</span></div></div></div>`; }).join('')}</div>`;
}

// ---- generic hub screen factory ------------------------------------------------------------------
function hubScreen(def) {
  UI.register({
    id: def.id,
    build(n) {
      n.innerHTML = `${backdrop([[700, 24], [1896, 24], [1896, 930], [430, 930]], { tone: '#cfc8b6' })}
        <div class="af-title" style="left:${def.clock ? '50%' : '800px'};top:34px;${def.clock ? 'transform:translateX(-30%);text-align:center' : ''}"><div class="t">${def.title}</div>${def.clock ? '<div class="timer af-tm hb-clock" style="text-align:center"><b>3:00</b></div>' : ''}</div>
        ${def.clock ? '' : '<div class="bigtimer hb-tm"><b>60</b></div>'}
        <div class="pp"></div><div class="hb-list"></div>
        <div class="hintbar" style="top:600px">${def.hint || 'メニューを選択してください'}</div>
        <div class="hb-strip"><div class="hb-row"></div><i class="mk l"></i><i class="mk r"></i></div>
        <div class="hb-desc"></div>
        <div class="cbx"></div>${logoMark()}${keyGuide([['lr', '選択'], ['ok', '決定'], ['back', '戻る']])}`;
    },
    enter(params = {}) {
      App.lot ||= new LotScene(App.gfx);
      const p = Save.profile;
      App.lot.setCars(p.cars.slice(0, 3).map(c => ({ spec: App.specOf(c), dress: c.dress })));
      App.lot.setPreset(def.scene || 'cars'); App.gfx.setView(App.lot);
      $('.pp', this.el).innerHTML = plate(); $('.cbx', this.el).innerHTML = consoleBox(); $('.hb-list', this.el).innerHTML = carList3();
      this.items = def.items();
      const row = $('.hb-row', this.el);
      row.innerHTML = this.items.map((it, k) => `<div class="hcard ${it.glyph ? 'g' : ''}" data-k="${k}">${it.glyph ? glyphSVG(it.glyph) : artSVG(it.art)}<div class="en">${it.en}</div><div class="lab" style="--band:${it.band || '#e05a00'}">${it.jp}</div>${it.badge ? `<div class="bdg">${it.badge}</div>` : ''}${it.off ? '<div class="off">準備中</div>' : ''}</div>`).join('');
      this.cards = $$('.hcard', row);
      this.cards.forEach((c, k) => c.onclick = () => { if (k === this.i) this.pick(); else { this.i = k; Audio.ui('move'); this.layout(); } });
      this.i = params.index ?? this.last ?? def.start ?? 0;
      this.layout();
      Audio.playMusic('menu');
      if (def.clock) startClockHub($('.hb-clock', this.el), 180, () => UI.go('mode'));
      else bigTimerHub($('.hb-tm', this.el), 60, () => this.pick());
    },
    leave() { stopTimer(); stopClockHub(); },
    layout() {
      const n = this.cards.length, loop = def.loop !== false && n > 3, W = 316, CX = 1080 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stage-extra')) || 0);
      this.cards.forEach((c, k) => {
        let d = k - this.i; if (loop) { if (d > n / 2) d -= n; if (d < -n / 2) d += n; }
        const vis = Math.abs(d) <= (loop ? 3 : n);
        c.style.display = vis ? '' : 'none';
        c.style.left = (CX + d * W + (d > 0 ? 44 : d < 0 ? -44 : 0) - 160) + 'px';
        c.classList.toggle('sel', d === 0); c.style.zIndex = 10 - Math.abs(d);
      });
      this.last = this.i;
      const it = this.items[this.i];
      $('.hb-desc', this.el).innerHTML = it.desc ? `<span>${it.en}</span>${esc(it.desc)}` : '';
    },
    pick() {
      const it = this.items[this.i];
      if (it.off) { Audio.ui('error'); return dialog.alert(it.jp, it.offText || `「${it.jp}」は現在準備中です。今後のアップデートをお楽しみに!`); }
      Audio.ui('ok'); stopTimer(); stopClockHub();
      it.go();
    },
    async onAction(a) {
      const n = this.cards.length;
      if (a === 'left' || a === 'right') { const loop = def.loop !== false && n > 3; let k = this.i + (a === 'left' ? -1 : 1); k = loop ? (k + n) % n : Math.max(0, Math.min(n - 1, k)); if (k !== this.i) { this.i = k; Audio.ui('move'); this.layout(); } return; }
      if (a === 'ok') return this.pick();
      if (a === 'back') { if (def.back) { Audio.ui('back'); stopTimer(); stopClockHub(); return def.back(); } }
    },
  });
}
let clk = null;
function startClockHub(node, secs, onZero) {
  stopClockHub(); if (!node) return;
  if (!App.settings.custTimer) { node.classList.add('off'); node.querySelector('b').textContent = 'NO TIME LIMIT'; return; }
  node.classList.remove('off', 'warn'); let left = secs;
  const draw = () => { node.querySelector('b').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; node.classList.toggle('warn', left <= 15); };
  draw(); clk = setInterval(() => { left--; draw(); if (left <= 0) { stopClockHub(); onZero && onZero(); } }, 1000);
}
function stopClockHub() { clearInterval(clk); clk = null; }
function bigTimerHub(node, secs, onZero) { if (!App.settings.custTimer) { node.classList.add('off'); return stopTimer(); } node.classList.remove('off'); startTimer(node, secs, onZero); }

const activeUid = () => Save.profile.activeCar || Save.profile.cars[0]?.uid;
const newsBadge = () => (Save.profile?.settings?.seenUpdate !== LATEST ? 'NEW' : '');

// ───────── START MENU ─────────
hubScreen({
  id: 'start', title: 'START MENU', scene: 'cars', loop: false,
  items: () => [
    { art: 'shop', en: 'Shop & Customize', jp: 'ショップ&カスタマイズ', band: 'linear-gradient(90deg,#d02a10,#ff7a00)', desc: '車両の購入、チューニング、ドレスアップ、パーツ購入。', go: () => UI.go('shopcust') },
    { art: 'mode', en: 'Mode Select', jp: 'モード選択', band: 'linear-gradient(90deg,#111,#3a3e46)', desc: 'タイムトライアル、コースバトル、オンラインバトルなどのモードを選びます。', go: () => UI.go('mode') },
    { art: 'online', en: 'Online Battle', jp: 'オンラインバトル', band: 'linear-gradient(90deg,#0a5ac0,#2aa8ff)', desc: 'ルームコード対戦、または世界中のプレイヤーと自動マッチング。', go: () => UI.go('online') },
    { art: 'config', en: 'Config & Play Data', jp: 'コンフィグ&プレイデータ', band: 'linear-gradient(90deg,#1a4ab0,#4a8aff)', desc: '設定の変更、プレイデータ・アカウントの確認。', go: () => UI.go('config') },
    { art: 'news', en: 'Update Log', jp: 'お知らせ', band: 'linear-gradient(90deg,#5a2aa0,#a05aff)', badge: newsBadge(), desc: 'アップデートの内容をチェック。', go: () => UI.go('news', { back: 'start' }) },
    { art: 'team', en: 'Team', jp: 'チーム', band: 'linear-gradient(90deg,#6aa000,#c8e000)', off: true, offText: 'チーム機能は今後のアップデートで追加予定です。<br>現在はプロフィールでチーム名を変更できます。', desc: 'チームを結成して仲間と記録を競おう(準備中)。', go: () => {} },
  ],
  back: async () => {
    if (await dialog.confirm('タイトルに戻る', 'タイトル画面に戻りますか?<br>(データは自動保存されています)', '戻る', 'キャンセル')) { await Save.persistNow('exit'); UI.go('title'); }
    else UI.go('start');
  },
});

// ───────── SHOP & CUSTOMIZE ─────────
hubScreen({
  id: 'shopcust', title: 'SHOP & CUSTOMIZE', scene: 'shop', clock: true, loop: false,
  items: () => [
    { art: 'shop', en: 'Shop', jp: 'ショップ', band: 'linear-gradient(90deg,#d02a10,#ff7a00)', desc: 'カーショップ・チューニング・ドレスアップ・パーツショップ。', go: () => UI.go('shop') },
    { art: 'custom', en: 'Customize', jp: 'カスタマイズ', band: 'linear-gradient(90deg,#0a5ac0,#2aa8ff)', desc: '登録車両の切替・ホイール・メーター・車両の追加と削除。', go: () => { App.hubReturn = 'shopcust'; UI.go('garage'); } },
    { art: 'mode', en: 'Mode Select', jp: 'モード選択', band: 'linear-gradient(90deg,#111,#3a3e46)', go: () => UI.go('mode') },
  ],
  back: () => UI.go('start'),
});

// ───────── SHOP ─────────
hubScreen({
  id: 'shop', title: 'SHOP', scene: 'shop', clock: true, start: 3,
  items: () => [
    { glyph: 'avatar', en: 'Avatar Shop', jp: 'アバター', desc: 'ドライバー名・チーム名・アイコンを変更します。', go: () => { App.hubReturn = 'shop'; UI.go('name', { edit: 'icon' }); } },
    { glyph: 'back', en: 'Back', jp: '前に戻る', go: () => UI.go('shopcust') },
    { glyph: 'mode', en: 'Mode Select', jp: 'モード選択', go: () => UI.go('mode') },
    { glyph: 'car', en: 'Car Shop', jp: 'カーショップ', desc: '新しい車両を購入してガレージに登録します(最大5台)。', go: () => { App.hubReturn = 'shop'; UI.go('carselect', { mode: 'add' }); } },
    { glyph: 'tune', en: 'Tuning', jp: 'チューニング', desc: 'TPを使ってエンジン・足回りなど17項目をチューニング。', go: () => { App.hubReturn = 'shop'; UI.go('tuning', { uid: activeUid() }); } },
    { glyph: 'dress', en: 'Dressup Shop', jp: 'ドレスアップ', desc: 'ボディカラー・ステッカー・エアロパーツ・車高。', go: () => { App.hubReturn = 'shop'; UI.go('dressup', { uid: activeUid(), flow: 'garage' }); } },
    { glyph: 'parts', en: 'Parts Shop', jp: 'パーツショップ', desc: 'エアロ・マフラー・ホイールなどのパーツを購入。', go: () => { App.hubReturn = 'shop'; UI.go('store', { uid: activeUid() }); } },
    { glyph: 'wheel', en: 'Wheel Shop', jp: 'ホイール', desc: 'ホイールのデザイン・カラー・サイズ・タイヤ。', go: () => { App.hubReturn = 'shop'; UI.go('wheel', { uid: activeUid(), back: 'garage' }); } },
    { glyph: 'cup', en: 'Accessory Shop', jp: 'アクセサリー', desc: 'カップ・称号・SPボディカラー。カスタマイズポイント(CP)で購入できます。ショップ限定!', go: () => { App.hubReturn = 'shop'; UI.go('acccustom', { mode: 'shop', cat: 'cup' }); } },
    { glyph: 'meter', en: 'Meter Shop', jp: 'メーター', desc: 'メーターのデザインとカラー。', go: () => { App.hubReturn = 'shop'; UI.go('meter', { uid: activeUid() }); } },
  ],
  back: () => UI.go('shopcust'),
});

// ───────── CONFIG & PLAY DATA ─────────
hubScreen({
  id: 'config', title: 'CONFIG & PLAY DATA', scene: 'cars', clock: true, loop: false,
  items: () => [
    { glyph: 'settings', en: 'Config', jp: '設定', desc: '音量・トランスミッション・アシスト・カメラ・グラフィックなど。', go: () => UI.go('settings', { back: 'config' }) },
    { glyph: 'data', en: 'Play Data', jp: 'プレイデータ', desc: '戦績・記録・アカウント状態・クラウド同期。', go: () => { App.hubReturn = 'config'; UI.go('profile'); } },
    { glyph: 'news', en: 'Update Log', jp: 'アップデート履歴', badge: newsBadge(), desc: 'これまでのアップデート内容。', go: () => UI.go('news', { back: 'config' }) },
    ...(devEnabled() ? [{ glyph: 'settings', en: 'Developer', jp: '開発者メニュー', desc: 'テスト用:クレジット・TP・CP追加、全パーツ・全コース・ストーリー解放、車の追加、車両デバッグ表示。', go: () => UI.go('devmenu') }] : []),
    { glyph: 'back', en: 'Back', jp: '前に戻る', go: () => UI.go('start', { index: 3 }) },
  ],
  back: () => UI.go('start', { index: 3 }),
});

// ───────── UPDATE LOG ─────────
UI.register({
  id: 'news',
  build(n) {
    n.innerHTML = `${backdrop([[700, 24], [1896, 24], [1896, 930], [430, 930]], { tone: '#cfc8b6' })}
      <div class="af-title" style="left:800px;top:34px"><div class="t">UPDATE LOG</div></div>
      <div class="pp"></div>
      <div class="nw-box"><div class="nw-vers"></div><div class="nw-body"></div></div>
      <div class="cbx"></div>${logoMark()}${keyGuide([['ud', 'バージョン'], ['back', '戻る']])}`;
  },
  enter(params = {}) {
    this.back = params.back || this.back || 'start';
    if (App.lot) { App.lot.setPreset('cars'); App.gfx.setView(App.lot); }
    if (Save.profile) { $('.pp', this.el).innerHTML = plate(); $('.cbx', this.el).innerHTML = consoleBox(); Save.profile.settings.seenUpdate = LATEST; Save.touch('settings'); }
    this.i = 0; this.render();
  },
  render() {
    $('.nw-vers', this.el).innerHTML = UPDATES.map((u, k) => `<div class="v${k === this.i ? ' on' : ''}" data-k="${k}"><b>${u.ver}</b><small>${u.date}</small>${k === 0 ? '<i>NEW</i>' : ''}</div>`).join('');
    $$('.nw-vers .v', this.el).forEach(v => v.onclick = () => { this.i = +v.dataset.k; Audio.ui('move'); this.render(); });
    const u = UPDATES[this.i];
    $('.nw-body', this.el).innerHTML = `<div class="hd"><span>${u.ver}</span>${esc(u.title)}</div><div class="dt">${u.date} 公開 · 現在のバージョン ${VERSION}</div><ul>${u.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="cr">CREDITS — 3D car models: "Ultimate Low-Poly Car Pack" by ProbablyNotG (sketchfab.com/mr_c0neDude), licensed under CC BY 4.0. Names and performance figures in this game are fictional.</div>`;
    const vb = $('.nw-body .dt', this.el); if (vb) vb.onclick = () => {
      this.devTaps = (this.devTaps || 0) + 1;
      if (devEnabled()) { if (this.devTaps === 1) toast('開発者モードは有効です(CONFIG → 開発者メニュー)'); return; }
      if (!devAllowed()) return;
      if (this.devTaps >= 7) { setDevMode(true); Audio.ui('start'); toast('開発者モードを有効にしました — CONFIG に「開発者メニュー」が追加されました'); }
      else if (this.devTaps >= 4) toast(`あと ${7 - this.devTaps} 回で開発者モード`);
    };
  },
  onAction(a) {
    if (a === 'up' || a === 'down') { this.i = Math.max(0, Math.min(UPDATES.length - 1, this.i + (a === 'up' ? -1 : 1))); Audio.ui('move'); return this.render(); }
    if (a === 'back' || a === 'ok') { Audio.ui('back'); UI.go(Save.profile ? this.back : 'title'); }
  },
});

// ───────── ONLINE BATTLE menu ─────────
hubScreen({
  id: 'online', title: 'ONLINE BATTLE', scene: 'cars', loop: false,
  hint: 'オンライン対戦のモードを選択してください',
  items: () => [
    { art: 'online', en: 'Worldwide Match', jp: 'ワールドワイド', band: 'linear-gradient(90deg,#0a5ac0,#2aa8ff)', desc: '世界中のプレイヤーと自動でマッチング。近いランクの相手が優先されます。', go: () => UI.go('netlobby', { kind: 'world' }) },
    { art: 'team', en: 'Code Battle', jp: 'ルーム作成', band: 'linear-gradient(90deg,#d02a10,#ff7a00)', desc: '6桁のルームコードを発行してフレンドと対戦。コースはあなたが決められます。', go: () => UI.go('netlobby', { kind: 'create' }) },
    { art: 'config', en: 'Code Battle', jp: 'コード入力', band: 'linear-gradient(90deg,#6aa000,#c8e000)', desc: 'フレンドから聞いたルームコードを入力して参加します。', go: () => UI.go('netlobby', { kind: 'join' }) },
    { art: 'mode', en: 'Back', jp: '前に戻る', band: 'linear-gradient(90deg,#111,#3a3e46)', go: () => UI.go('start', { index: 2 }) },
  ],
  back: () => UI.go('start', { index: 2 }),
});
