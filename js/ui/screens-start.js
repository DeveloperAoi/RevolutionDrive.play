// Start flow: INITIALIZING → TITLE ⇄ ATTRACT → ENTRY → (ACCOUNT) → DATA CHECK → NAME → PLAYER INIT
import { UI, Focus, $, $$, el, esc, dialog, toast, sleep, startTimer, stopTimer, avatarSVG, rankBadge, footer, ICON_COUNT } from './core.js';
import { App, VERSION, SITE_URL } from '../app.js';
import { Audio } from '../audio/audio.js';
import { Input } from '../core/input.js';
import { Save, idbAvailable, rankOf } from '../core/save.js';
import * as Net from '../net/firebase.js';
import { Showroom, TitleScene } from '../game/gfx.js';
import { Race } from '../game/race.js';
import { CARS, carById, buildSpec, MAKERS } from '../data/cars.js';
import { COURSES } from '../data/courses.js';

const MAX_PROFILES = 3;

// ───────────────────────── INITIALIZING ─────────────────────────
UI.register({
  id: 'init',
  build(n) { n.innerHTML = `<div class="log"></div><div class="big">INITIALIZING<span>...</span></div><div class="bar"><i></i></div><div class="ver">REVOLUTION DRIVE ${VERSION} — SYSTEM BOOT</div>`; },
  async enter() {
    const log = $('.log', this.el), bar = $('.bar i', this.el);
    const line = async (label, fn) => {
      const row = el(`<div>${label.padEnd(34, '.')} <span>…</span></div>`); log.appendChild(row);
      let ok = true, txt = 'OK';
      try { const r = await fn(); if (typeof r === 'string') txt = r; if (r === false) { ok = false; txt = 'N/A'; } } catch (e) { ok = false; txt = 'FAILED'; console.warn(label, e); }
      row.lastChild.textContent = txt; row.lastChild.className = ok ? 'ok' : 'ng';
      bar.style.width = (log.children.length / 8 * 100) + '%';
      await sleep(140);
      return ok;
    };
    await line('CHECKING GRAPHICS (WebGL2)', () => !!App.gfx.renderer.capabilities.isWebGL2 || 'WEBGL1');
    await line('BUILDING ENVIRONMENT MAPS', () => !!App.gfx.env);
    await line('CHECKING SOUND SYSTEM', () => !!(window.AudioContext || window.webkitAudioContext));
    await line('CHECKING LOCAL STORAGE (IndexedDB)', async () => await idbAvailable());
    await line('CHECKING NETWORK', () => navigator.onLine ? 'ONLINE' : 'OFFLINE');
    await line('CONNECTING TO GAME SERVER', async () => {
      if (!Net.isConfigured()) return 'NOT CONFIGURED (GUEST ONLY)';
      await Promise.race([Net.init(), sleep(6000).then(() => { throw new Error('timeout'); })]);
      return 'CONNECTED';
    });
    await line('LOADING VEHICLE DATA', () => `${CARS.length} CARS`);
    await line('LOADING COURSE DATA', () => { App.showroom = new Showroom(App.gfx); return `${COURSES.length} COURSES`; });
    bar.style.width = '100%';
    await sleep(500);
    UI.go('title');
  },
});

// ───────────────────────── TITLE ─────────────────────────
UI.register({
  id: 'title',
  build(n) {
    n.innerHTML = `<div class="vignette"></div><div class="speedlines"></div>
      <div class="logo intro"><div class="rev">REV<em>O</em>LUTION</div><div class="drive">DRIVE</div><div class="tag">TOUGE ARCADE RACING</div><div class="tag-jp">峠 最 速 伝 説</div></div>
      <div class="press focusable"><b>PRESS START</b><small>ENTER / クリック / タップでスタート</small></div>
      <div class="title-foot">
        <div class="copy">© REVOLUTION DRIVE PROJECT<br>All vehicles, courses and names in this game are fictional.<br>Free to play — no payment required.</div>
        <div class="icons">
          <a class="iconbtn" href="${SITE_URL}" target="_blank" rel="noopener"><span class="ic">WEB</span>公式サイト</a>
          <div class="iconbtn" data-a="sound"><span class="ic">♪</span><span>SOUND ON</span></div>
          <div class="iconbtn" data-a="settings"><span class="ic">⚙</span>設定</div>
        </div>
        <div class="ver">${VERSION}</div>
      </div>`;
    const sl = $('.speedlines', n);
    for (let i = 0; i < 18; i++) { const s = document.createElement('i'); s.style.top = (Math.random() * 100) + '%'; s.style.width = (200 + Math.random() * 400) + 'px'; s.style.animationDuration = (1.2 + Math.random() * 2) + 's'; s.style.animationDelay = (-Math.random() * 3) + 's'; s.style.opacity = 0.2 + Math.random() * 0.5; sl.appendChild(s); }
  },
  enter() {
    if (!App.titleScene) {
      const spec = buildSpec(carById('ryujin_r7'));
      App.titleScene = new TitleScene(App.gfx, spec, { paint: 'yellow', wheel: 'black8', spoiler: 'gt', aero: 'street', muffler: 'big', decal: 'stripe', height: 2 });
    }
    App.gfx.setView(App.titleScene);
    const logo = $('.logo', this.el); logo.classList.remove('intro'); void logo.offsetWidth; logo.classList.add('intro');
    Audio.playMusic('title');
    this.updSound();
    const items = [$('.press', this.el), ...$$('.iconbtn', this.el)];
    this.focus = new Focus(items, { axis: 'h', wrap: false, onSelect: (i, it) => this.pick(it) });
    this.idle = 0; clearInterval(this.idleH);
    this.idleH = setInterval(() => { if (++this.idle >= 35 && UI.current === this && !dialog.open) UI.go('attract'); }, 1000);
  },
  leave() { clearInterval(this.idleH); },
  updSound() { $('[data-a=sound] span:last-child', this.el).textContent = App.settings.bgm > 0 ? 'SOUND ON' : 'SOUND OFF'; },
  pick(it) {
    if (it.classList.contains('press')) { Audio.unlock(); Audio.ui('start'); UI.go('entry'); return; }
    if (it.tagName === 'A') { window.open(SITE_URL, '_blank', 'noopener'); return; }
    const a = it.dataset.a;
    if (a === 'sound') { Audio.unlock(); const s = App.settings; const on = s.bgm > 0 || s.sfx > 0; s.bgm = on ? 0 : 6; s.sfx = on ? 0 : 8; App.applySettings(); this.updSound(); Audio.ui('ok'); }
    if (a === 'settings') { Audio.ui('ok'); UI.go('settings', { back: 'title' }); }
  },
  onAction(a) { this.idle = 0; if (a === 'back') return; this.focus.action(a); },
});
addEventListener('pointerdown', () => { if (UI.current && UI.current.id === 'title') UI.current.idle = 0; });

// ───────────────────────── ATTRACT (demo play) ─────────────────────────
UI.register({
  id: 'attract',
  build(n) {
    n.innerHTML = `<div style="position:absolute;left:0;right:0;top:0;height:110px;background:#000"></div><div style="position:absolute;left:0;right:0;bottom:0;height:150px;background:#000"></div>
      <div style="position:absolute;left:60px;top:30px;font-size:40px;font-style:italic;color:var(--orange2);letter-spacing:6px">DEMO PLAY</div>
      <div class="demo-course" style="position:absolute;right:60px;top:26px;text-align:right;font-style:italic;font-size:30px"></div>
      <div class="demo-info" style="position:absolute;left:50%;bottom:190px;transform:translateX(-50%);width:900px;padding:22px 40px;background:rgba(20,26,40,.75);border:3px solid rgba(200,210,230,.8);border-radius:16px;font-family:var(--jp);font-weight:900;font-size:30px;line-height:46px;color:#dfe6f0;text-align:left"></div>
      <div class="press" style="bottom:50px"><b style="font-size:48px">PRESS START</b></div>
      <div style="position:absolute;left:0;right:0;bottom:14px;text-align:center;font-size:24px;color:#ddd">${VERSION}</div>`;
  },
  enter() {
    const course = COURSES[Math.floor(Math.random() * COURSES.length)];
    const pickCars = CARS.slice().sort(() => Math.random() - .5).slice(0, 3);
    const paints = ['white', 'red', 'blue', 'yellow', 'black', 'silver'];
    const rivals = pickCars.map((c, k) => ({ spec: buildSpec(c, { engine: 2, tires: 2 }), dress: { paint: paints[(k * 2 + Math.floor(Math.random() * 2)) % paints.length], wheel: ['mesh', 'gold6', 'black8'][k], spoiler: ['gt', 'mid', 'duck'][k], aero: 'street', decal: ['stripe', 'number', 'side'][k], number: String(10 + k * 7) }, skill: 0.93 - k * 0.015, aggr: 0.7 }));
    this.race = new Race(App.gfx, { mode: 'attract', courseId: course.id, dir: Math.random() < 0.5 ? 'fwd' : 'rev', rivals, onDemoEnd: () => this.exit() });
    App.gfx.setView({ scene: this.race.scene, camera: this.race.camera, update: (dt) => this.race.update(dt) });
    this.race.start(); Audio.stopMusic();
    $('.demo-course', this.el).innerHTML = `${course.name}<br><span style="font-family:var(--jp);font-size:24px;color:#ccc">${course.jp}</span>`;
    const infos = [
      Net.isConfigured() ? 'ONLINE BATTLE は次回アップデートで解放予定です。' : 'サーバー未設定のため、ACCOUNT PLAY / ONLINE BATTLE は現在ご利用いただけません。',
      'GUEST PLAY ならアカウント登録なしで、データを端末に保存して遊べます。',
      'サイドブレーキ(SPACE)でドリフトのきっかけを作り、カウンターステアでラインをコントロール!',
    ];
    let k = 0; const box = $('.demo-info', this.el); box.textContent = infos[0];
    clearInterval(this.infoH); this.infoH = setInterval(() => { k = (k + 1) % infos.length; box.textContent = infos[k]; }, 6000);
    clearTimeout(this.endH); this.endH = setTimeout(() => this.exit(), 45000);
    this.onPtr = () => this.exit(); addEventListener('pointerdown', this.onPtr);
  },
  exit() { if (UI.current === this) UI.go('title'); },
  leave() { clearInterval(this.infoH); clearTimeout(this.endH); removeEventListener('pointerdown', this.onPtr); if (this.race) { this.race.dispose(); this.race = null; } },
  onAction() { this.exit(); },
});

// ───────────────────────── ENTRY: GUEST / ACCOUNT ─────────────────────────
UI.register({
  id: 'entry',
  build(n) {
    n.innerHTML = `<div class="half l"></div><div class="half r"></div><div class="entry-num timer" style="right:70px;top:30px"><b style="font-size:150px;line-height:150px;-webkit-text-stroke:0">30</b></div>
      <div class="entry-card l focusable"><div><div class="jp">ログインなしで遊ぶ</div><div class="en">GUEST PLAY</div></div><div class="start">START</div></div>
      <div class="entry-card r focusable"><div><div class="jp">アカウントで遊ぶ</div><div class="en">ACCOUNT PLAY</div></div></div>
      <div class="entry-note l">アカウント登録なしですぐにプレイ。<ul><li>データはこの端末(IndexedDB)に自動保存</li><li>すべての基本ゲーム機能が利用可能</li><li>あとからアカウントへ引き継ぎもOK</li></ul></div>
      <div class="entry-note r">メールアドレスでログインしてプレイ。<ul><li>クラウドにセーブデータを自動同期</li><li>別の端末でも自分のデータを引き継げる</li><li>ゲストデータの引き継ぎに対応</li></ul><div class="acct-state" style="margin-top:18px;font-size:24px"></div></div>
      ${footer([['←→', '選択'], ['ENTER', '決定'], ['ESC', '戻る']])}`;
  },
  enter() {
    App.gfx.setView(App.titleScene);
    const cards = $$('.entry-card', this.el);
    this.focus = new Focus(cards, { axis: 'h', wrap: false, onSelect: (i) => this.pick(i) });
    const st = $('.acct-state', this.el);
    st.innerHTML = !Net.isConfigured() ? '<span style="color:#ffd400">⚠ サーバー未設定のため現在ご利用いただけません</span>'
      : Net.currentUser && !Net.currentUser.isAnonymous ? `<span style="color:#3dff8a">● ログイン中: ${esc(Net.currentUser.email)}</span>` : '<span style="color:#cde">ログイン / 新規登録</span>';
    Audio.playMusic('menu');
    startTimer($('.timer', this.el), 30, () => this.pick(this.focus.i));
  },
  async pick(i) {
    if (i === 0) { Audio.ui('ok'); Save.setGuest(); UI.go('datacheck'); return; }
    if (!Net.isConfigured()) {
      stopTimer();
      await dialog.alert('ACCOUNT PLAY', 'ゲームサーバーが未設定のため、現在アカウント機能はご利用いただけません。<br>GUEST PLAYでお楽しみください。');
      startTimer($('.timer', this.el), 30, () => this.pick(0)); return;
    }
    Audio.ui('ok'); UI.go('account');
  },
  onAction(a) { if (a === 'back') { Audio.ui('back'); UI.go('title'); return; } this.focus.action(a); },
});

// ───────────────────────── ACCOUNT (login / register / reset / info) ─────────────────────────
UI.register({
  id: 'account',
  build(n) { n.innerHTML = `<div class="bg-metal" style="opacity:.92"></div><div class="modal acct"></div>${footer([['TAB', '項目移動'], ['ENTER', '決定'], ['ESC', '戻る']])}`; },
  async enter(params = {}) {
    App.gfx.setView(App.titleScene);
    this.from = params.from || 'entry';
    try { await Net.init(); } catch { }
    this.view(Net.currentUser && !Net.currentUser.isAnonymous ? 'info' : (params.view || 'login'));
  },
  async view(v) {
    this.v = v; const box = $('.acct', this.el);
    const guests = await Save.localProfiles('guest');
    const forms = {
      login: `<h2>ACCOUNT LOGIN</h2><div class="sub">メールアドレスとパスワードでログイン</div>
        <label class="field"><span>EMAIL</span><input type="email" name="email" autocomplete="email"></label>
        <label class="field"><span>PASSWORD</span><input type="password" name="pw" autocomplete="current-password"></label>
        <div class="msg"></div><div class="row"><button class="btn blue" data-a="login">LOGIN</button><button class="btn dark" data-a="back">BACK</button>
        <span style="margin-left:auto;display:flex;flex-direction:column;gap:10px;align-items:flex-end"><button class="link" data-a="v:register">新規アカウント登録 ▶</button><button class="link" data-a="v:reset">パスワードを忘れた方 ▶</button></span></div>`,
      register: `<h2>NEW ACCOUNT</h2><div class="sub">パスワードはFirebase Authenticationで安全に管理され、ゲーム内には保存されません。</div>
        <label class="field"><span>EMAIL</span><input type="email" name="email" autocomplete="email"></label>
        <label class="field"><span>PASSWORD(6文字以上)</span><input type="password" name="pw" autocomplete="new-password"></label>
        <label class="field"><span>PASSWORD(確認)</span><input type="password" name="pw2" autocomplete="new-password"></label>
        ${guests.length ? `<label class="check"><input type="checkbox" name="mig" checked> この端末のゲストデータ「${esc(guests[0].driverName || 'GUEST')}」(${rankOf(guests[0].rp).label})をアカウントに引き継ぐ</label>` : ''}
        <div class="msg"></div><div class="row"><button class="btn blue" data-a="register">REGISTER</button><button class="btn dark" data-a="v:login">BACK</button></div>`,
      reset: `<h2>PASSWORD RESET</h2><div class="sub">登録メールアドレスに再設定用リンクを送信します。</div>
        <label class="field"><span>EMAIL</span><input type="email" name="email" autocomplete="email"></label>
        <div class="msg"></div><div class="row"><button class="btn blue" data-a="reset">SEND</button><button class="btn dark" data-a="v:login">BACK</button></div>`,
      info: () => { const u = Net.currentUser; return `<h2>ACCOUNT</h2><div class="sub">ログイン中のアカウント</div>
        <div style="font-size:30px;line-height:54px;font-family:var(--jp);font-weight:900">${esc(u.email)}<br><span style="font-size:22px;color:${u.emailVerified ? '#3dff8a' : '#ffd400'}">${u.emailVerified ? '✔ メール認証済み' : '⚠ メール未認証(受信箱を確認してください)'}</span></div>
        ${guests.length && !guests.some(g => g.migratedTo === u.uid) ? `<label class="check"><input type="checkbox" name="mig"> ゲストデータ「${esc(guests[0].driverName || 'GUEST')}」をこのアカウントに引き継ぐ</label>` : ''}
        <div class="msg"></div><div class="row"><button class="btn blue" data-a="continue">このアカウントで続ける</button><button class="btn dark" data-a="logout">LOGOUT</button><button class="btn dark" data-a="back">BACK</button></div>`; },
    };
    box.innerHTML = typeof forms[v] === 'function' ? forms[v]() : forms[v];
    const btns = $$('button', box);
    this.focus = new Focus(btns, { axis: 'h', onSelect: (i, b) => this.act(b.dataset.a) });
    const first = $('input', box); if (first) setTimeout(() => first.focus(), 50);
  },
  msg(t, ok) { const m = $('.msg', this.el); m.textContent = t; m.className = 'msg ' + (ok ? 'ok' : 'err'); if (!ok) Audio.ui('error'); },
  val(name) { const i = $(`[name=${name}]`, this.el); return i ? (i.type === 'checkbox' ? i.checked : i.value.trim()) : ''; },
  async act(a) {
    if (!a) return;
    if (a.startsWith('v:')) { Audio.ui('ok'); return this.view(a.slice(2)); }
    if (a === 'back') { Audio.ui('back'); return UI.go(this.from); }
    try {
      if (a === 'login') {
        const email = this.val('email'), pw = $('[name=pw]', this.el).value;
        if (!email || !pw) return this.msg('メールアドレスとパスワードを入力してください。');
        this.msg('ログイン中…', true); await Net.login(email, pw); Audio.ui('ok');
        return this.enterAccount(false);
      }
      if (a === 'register') {
        const email = this.val('email'), pw = $('[name=pw]', this.el).value, pw2 = $('[name=pw2]', this.el).value;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return this.msg('メールアドレスの形式が正しくありません。');
        if (pw.length < 6) return this.msg('パスワードは6文字以上にしてください。');
        if (pw !== pw2) return this.msg('確認用パスワードが一致しません。');
        const mig = this.val('mig');
        this.msg('登録中…', true); await Net.register(email, pw); Audio.ui('ok');
        toast('アカウントを作成しました。確認メールを送信しました。');
        return this.enterAccount(mig);
      }
      if (a === 'reset') {
        const email = this.val('email'); if (!email) return this.msg('メールアドレスを入力してください。');
        await Net.resetPassword(email); this.msg('再設定メールを送信しました。受信箱を確認してください。', true); Audio.ui('ok'); return;
      }
      if (a === 'continue') { Audio.ui('ok'); return this.enterAccount(this.val('mig')); }
      if (a === 'logout') { await Net.logout(); Audio.ui('back'); toast('ログアウトしました'); return this.view('login'); }
    } catch (e) { console.warn(e); this.msg(Net.errText(e)); }
  },
  async enterAccount(migrate) {
    Save.setAccount(Net.currentUser.uid);
    if (migrate) {
      const guests = await Save.localProfiles('guest');
      if (guests[0]) {
        const r = await Save.migrateGuest(guests[0]);
        toast(r.already ? 'このゲストデータは既に引き継ぎ済みです' : 'ゲストデータをアカウントに引き継ぎました');
      }
    }
    UI.go('datacheck');
  },
  onAction(a) {
    if (a === 'submit') { const b = $('button[data-a=login],button[data-a=register],button[data-a=reset]', this.el); if (b) this.act(b.dataset.a); return; }
    if (a === 'back') { if (this.v === 'register' || this.v === 'reset') return this.view('login'); Audio.ui('back'); return UI.go(this.from); }
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    this.focus && this.focus.action(a);
  },
});

// ───────────────────────── DATA CHECK ─────────────────────────
UI.register({
  id: 'datacheck',
  build(n) {
    n.innerHTML = `<div class="bg-metal"></div><div class="timer" style="right:70px;top:30px"><small>TIME</small><b>20</b></div>
      <div style="position:absolute;left:50%;top:80px;transform:translateX(-50%);width:1340px;height:820px;background:linear-gradient(180deg,#3a3e46,#15171b);border:5px solid #aab0b8;border-radius:30px;box-shadow:0 30px 80px #000">
        <div class="lic" style="position:absolute;left:180px;right:180px;top:36px;height:520px"></div>
        <div class="pager" style="position:absolute;left:0;right:0;top:575px;text-align:center;font-size:26px;color:#aaa"></div>
        <div style="position:absolute;left:30px;right:30px;top:615px;border-top:3px solid #666"></div>
        <div style="position:absolute;left:0;right:0;top:640px;text-align:center;font-family:var(--jp);font-weight:900;font-size:42px">このプレイヤーデータを使用しますか?</div>
        <div class="row" style="position:absolute;left:0;right:0;top:715px;justify-content:center;gap:80px">
          <button class="btn blue" style="min-width:340px;height:86px;font-size:44px;border-radius:44px;clip-path:none" data-a="yes">YES</button>
          <button class="btn" style="min-width:340px;height:86px;font-size:44px;border-radius:44px;clip-path:none;background:linear-gradient(180deg,#ff8a8a,#e01818 50%,#b00 51%,#ff4a4a);color:#fff" data-a="no">NO</button></div>
      </div>
      ${footer([['←→', '選択'], ['↑↓', 'データ切替'], ['ENTER', '決定'], ['ESC', '戻る']])}`;
  },
  async enter() {
    App.gfx.setView(App.showroom);
    this.list = [];
    try { this.list = await Save.listProfiles(); } catch (e) { console.warn(e); toast('データの読み込みに失敗しました'); }
    if (!this.list.length) { UI.busy = false; UI.go('name', { isNew: true }); return; }
    this.idx = 0; this.render();
    this.focus = new Focus($$('.row .btn', this.el), { axis: 'h', wrap: false, onSelect: (i, b) => this.pick(b.dataset.a) });
    startTimer($('.timer', this.el), 20, () => this.pick('yes'));
  },
  render() {
    const p = this.list[this.idx]; const r = rankOf(p.rp);
    const car = p.cars.find(c => c.uid === p.activeCar) || p.cars[0];
    if (car) App.showroom.setCar(App.specOf(car), car.dress);
    const last = new Date(p.lastPlayed || p.updatedAt);
    $('.lic', this.el).innerHTML = `
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,#fff,#f1d6d6);border:4px solid #c00;border-radius:22px;overflow:hidden;color:#111">
        <div style="height:70px;background:linear-gradient(90deg,#b00,#e22 60%,#ff7a00);display:flex;align-items:center;padding:0 30px;gap:30px;color:#fff">
          <b style="font-family:var(--jp);font-size:30px">REVOLUTION DRIVE 走行ライセンス</b><b style="margin-left:auto;font-style:italic;font-size:30px">${Save.mode === 'account' ? 'ACCOUNT' : 'GUEST'} DATA</b></div>
        <div style="position:absolute;left:30px;top:96px;width:260px;height:260px;border:4px solid #666;border-radius:12px;overflow:hidden">${avatarSVG(p.icon, 252)}</div>
        <div style="position:absolute;left:320px;top:96px;right:220px;height:130px;background:#fff;border:3px solid #999;border-radius:12px;display:grid;place-items:center;font-size:72px;font-style:italic">${esc(p.driverName || 'DRIVER')}</div>
        <div style="position:absolute;right:30px;top:96px;width:170px;height:130px;background:#fff;border:3px solid #999;border-radius:12px;display:grid;place-items:center">${rankBadge(p.rp, 110)}</div>
        <div style="position:absolute;left:320px;right:30px;top:246px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
          ${[['CARS', p.cars.length + ' / 5'], ['RACES', p.stats.races], ['WINS', p.stats.wins], ['CREDITS', '¥' + p.credits.toLocaleString()]].map(([k, v]) => `<div style="background:#fff;border:3px solid #999;border-radius:10px;text-align:center;padding:8px 0"><div style="font-size:16px;color:#c00">${k}</div><div style="font-size:30px;font-style:italic">${v}</div></div>`).join('')}</div>
        <div style="position:absolute;left:30px;right:30px;top:380px;display:grid;grid-template-columns:200px 1fr;border:3px solid #999;border-radius:10px;overflow:hidden;font-family:var(--jp);font-weight:900;font-size:28px">
          <div style="background:#c00;color:#fff;padding:10px 20px">チーム名</div><div style="background:#fff;padding:10px 20px">${esc(p.teamName || '---')}</div>
          <div style="background:#c00;color:#fff;padding:10px 20px;border-top:2px solid #fff">最終プレイ</div><div style="background:#fff;padding:10px 20px;border-top:2px solid #ddd">${last.toLocaleString('ja-JP')}</div></div>
      </div>`;
    $('.pager', this.el).textContent = this.list.length > 1 ? `◀ DATA ${this.idx + 1} / ${this.list.length} ▶  (↑↓で切替)` : '';
  },
  async pick(a) {
    stopTimer();
    if (a === 'yes') { Audio.ui('ok'); await Save.use(this.list[this.idx]); UI.go('playerinit'); return; }
    // NO → new player data in a separate slot (never deletes silently)
    if (this.list.length >= MAX_PROFILES) {
      const ok = await dialog.confirm('データ上書きの確認', `保存できるプレイヤーデータは${MAX_PROFILES}件までです。<br>表示中のデータ「${esc(this.list[this.idx].driverName)}」を<b style="color:#ff6a6a">削除して</b>新しいデータを作成しますか?`, '上書きする', 'やめる');
      if (!ok) return startTimer($('.timer', this.el), 20, () => this.pick('yes'));
      const ok2 = await dialog.confirm('最終確認', '削除したデータは元に戻せません。本当によろしいですか?', '削除して作成', 'やめる');
      if (!ok2) return startTimer($('.timer', this.el), 20, () => this.pick('yes'));
      await Save.deleteProfile(this.list[this.idx]);
    } else {
      const ok = await dialog.confirm('新規プレイヤー作成', '新しいプレイヤーデータを作成します。<br>既存のデータは削除されず、そのまま残ります。', '作成する', 'やめる');
      if (!ok) return startTimer($('.timer', this.el), 20, () => this.pick('yes'));
    }
    UI.go('name', { isNew: true });
  },
  onAction(a) {
    if (a === 'back') { Audio.ui('back'); UI.go('entry'); return; }
    if ((a === 'up' || a === 'down') && this.list.length > 1) { this.idx = (this.idx + (a === 'up' ? -1 : 1) + this.list.length) % this.list.length; Audio.ui('move'); this.render(); return; }
    this.focus && this.focus.action(a);
  },
});

// ───────────────────────── NAME ENTRY (driver + team) ─────────────────────────
const KEYS = 'ABCDEFGHIJKLMN OPQRSTUVWXYZ01 23456789★-.!?&# '.split(' ').join('').split('');
const NG = ['FUCK', 'SHIT', 'KILL', 'NAZI'];
UI.register({
  id: 'name',
  build(n) {
    n.innerHTML = `<div class="hdr"><button class="btn small dark" data-a="back">◀ 戻る</button><div class="q"></div></div>
      <div class="timer"><small>TIME</small><b>90</b></div>
      <div class="hint"></div><div class="tabs"><b data-t="driver">DRIVER NAME</b><b data-t="team">TEAM NAME</b><b data-t="icon">ICON</b></div>
      <div class="slots"></div><div class="name-err"></div><div class="kb"></div>`;
  },
  enter(params = {}) {
    App.gfx.setView(App.showroom);
    this.isNew = !!params.isNew; this.edit = params.edit || null;
    const p = this.isNew ? null : Save.profile;
    this.vals = { driver: p?.driverName || '', team: p?.teamName || '', icon: p?.icon || 0 };
    this.stage(this.edit || 'driver');
    Input.textCapture = (e) => this.physKey(e);
    $('[data-a=back]', this.el).onclick = () => this.back();
  },
  leave() { Input.textCapture = null; },
  stage(t) {
    this.t = t;
    $$('.tabs b', this.el).forEach(b => b.classList.toggle('on', b.dataset.t === t));
    const max = t === 'driver' ? 8 : 10; this.max = max;
    $('.q', this.el).textContent = t === 'driver' ? 'ドライバー名を入力してください' : t === 'team' ? 'チーム名を入力してください' : 'プレイヤーアイコンを選んでください';
    $('.hint', this.el).textContent = t === 'icon' ? '←→で選択、決定で登録' : `英字・数字・記号 ${max}文字まで(キーボード入力もOK)`;
    $('.name-err', this.el).textContent = '';
    if (t === 'icon') return this.renderIcons();
    this.renderKb(); this.renderSlots();
    startTimer($('.timer', this.el), 90, () => this.confirm(true));
  },
  renderSlots() {
    const v = this.vals[this.t]; let html = '';
    for (let i = 0; i < this.max; i++) html += `<div class="slot ${i === v.length ? 'cur' : ''}" style="${this.max > 8 ? 'width:130px;font-size:96px' : ''}">${esc(v[i] === ' ' ? '' : (v[i] || ''))}</div>`;
    $('.slots', this.el).innerHTML = html;
  },
  renderKb() {
    const kb = $('.kb', this.el); kb.style.display = '';
    kb.innerHTML = KEYS.map(k => `<div class="k" data-k="${esc(k)}">${esc(k)}</div>`).join('') +
      `<div class="k wide2" data-k="SPACE">スペース</div><div class="k wide3" data-k="DEL">← 1文字削除</div><div class="k wide2" data-k="CLR">全消去</div><div class="k wide3" data-k="BACK">戻る</div><div class="k ok" data-k="OK">決定</div>`;
    const keys = $$('.k', kb);
    this.focus = new Focus(keys, { axis: 'grid', cols: 14, sound: false, onSelect: (i, k) => this.press(k.dataset.k, k) });
  },
  renderIcons() {
    stopTimer();
    $('.kb', this.el).style.display = 'none';
    const s = $('.slots', this.el);
    s.innerHTML = Array.from({ length: ICON_COUNT }, (_, i) => `<div class="slot" style="width:190px;height:190px;padding:0;overflow:hidden" data-i="${i}">${avatarSVG(i, 180)}</div>`).join('') ;
    s.insertAdjacentHTML('afterend', '');
    const items = $$('.slot', s);
    this.focus = new Focus(items, { axis: 'h', index: this.vals.icon, onChange: (i) => { this.vals.icon = i; }, onSelect: (i) => { this.vals.icon = i; this.finish(); } });
    items.forEach(it => it.style.transition = '.15s');
    const style = () => items.forEach((it, k) => it.style.transform = k === this.focus.i ? 'scale(1.12)' : '');
    const orig = this.focus.apply.bind(this.focus); this.focus.apply = () => { orig(); style(); }; style();
    if (!$('.icon-ok', this.el)) this.el.insertAdjacentHTML('beforeend', `<div class="icon-ok" style="position:absolute;left:0;right:0;bottom:120px;text-align:center"><button class="btn primary">決定</button></div>`);
    $('.icon-ok', this.el).style.display = '';
    $('.icon-ok button', this.el).onclick = () => { Audio.ui('ok'); this.finish(); };
  },
  press(k, node) {
    if (node) { node.classList.add('press'); setTimeout(() => node.classList.remove('press'), 90); }
    const v = this.vals[this.t];
    if (k === 'OK') return this.confirm(false);
    if (k === 'BACK') return this.back();
    Audio.ui('key');
    if (k === 'DEL') this.vals[this.t] = v.slice(0, -1);
    else if (k === 'CLR') this.vals[this.t] = '';
    else if (v.length < this.max) this.vals[this.t] = v + (k === 'SPACE' ? ' ' : k);
    else { Audio.ui('error'); $('.name-err', this.el).textContent = `${this.max}文字までです`; }
    this.renderSlots();
  },
  physKey(e) {
    if (UI.current !== this || this.t === 'icon' || dialog.open) return false;
    if (e.key.length === 1 && /[A-Za-z0-9\-.!?&# ]/.test(e.key)) { e.preventDefault(); this.press(e.key === ' ' ? 'SPACE' : e.key.toUpperCase()); return true; }
    if (e.key === 'Backspace') { e.preventDefault(); this.press('DEL'); return true; }
    if (e.key === 'Enter') { e.preventDefault(); this.confirm(false); return true; }
    return false;
  },
  validate(v) {
    const t = v.trim();
    if (!t) return '1文字以上入力してください';
    if (!/^[A-Z0-9★\-.!?&# ]+$/.test(t)) return '使用できない文字が含まれています';
    if (NG.some(w => t.replace(/\s/g, '').includes(w))) return 'この名前は使用できません';
    return null;
  },
  confirm(timeout) {
    let v = this.vals[this.t].trim();
    if (timeout && !v) v = this.vals[this.t] = this.t === 'driver' ? 'GUEST' : 'NO TEAM';
    const err = this.validate(v);
    if (err) { Audio.ui('error'); $('.name-err', this.el).textContent = err; return; }
    this.vals[this.t] = v; Audio.ui('ok'); stopTimer();
    if (this.edit) return this.finish();
    if (this.t === 'driver') this.stage('team'); else if (this.t === 'team') this.stage('icon');
  },
  async finish() {
    if (this.edit || !this.isNew) {
      const p = Save.profile; p.driverName = this.vals.driver; p.teamName = this.vals.team; p.icon = this.vals.icon;
      Save.touch('rename'); toast('プレイヤー情報を保存しました'); UI.go('profile'); return;
    }
    const p = Save.create(); p.driverName = this.vals.driver; p.teamName = this.vals.team; p.icon = this.vals.icon;
    await Save.persistNow('register');
    UI.go('playerinit', { fresh: true });
  },
  back() {
    stopTimer(); Audio.ui('back');
    if (this.edit) return UI.go('profile');
    if (this.t === 'icon') { $('.icon-ok', this.el).style.display = 'none'; return this.stage('team'); }
    if (this.t === 'team') return this.stage('driver');
    UI.go(this.isNew ? 'entry' : 'start');
  },
  onAction(a) {
    if (a === 'back') return this.back();
    if (this.focus) this.focus.action(a);
  },
});

// ───────────────────────── PLAYER INITIALIZATION ─────────────────────────
UI.register({
  id: 'playerinit',
  build(n) { n.innerHTML = `<div class="bg-metal"></div><div class="init-title">PLAYER INITIALIZATION</div><div class="pcard"></div>`; },
  async enter(params = {}) {
    App.gfx.setView(App.showroom);
    const p = Save.profile; const r = rankOf(p.rp);
    $('.pcard', this.el).innerHTML = `<div class="stripe"><b>${params.fresh ? 'NEW DRIVER REGISTERED' : 'WELCOME BACK'}</b></div>
      <div style="position:absolute;left:60px;top:150px;border:4px solid #888;border-radius:16px;overflow:hidden">${avatarSVG(p.icon, 200)}</div>
      <div class="info" style="left:300px"><div><label>DRIVER</label><span class="v">${esc(p.driverName)}</span></div><div><label>TEAM</label><span class="v" style="font-family:var(--jp)">${esc(p.teamName)}</span></div>
      <div><label>CREDITS</label><span class="v credits">¥${p.credits.toLocaleString()}</span></div><div><label>DATA</label><span class="v" style="font-size:30px">${Save.mode === 'account' ? 'CLOUD SYNC' : 'LOCAL (THIS DEVICE)'}</span></div></div>
      <div class="rk"><div><small>RANK</small><b>${r.label}</b><small>${p.rp} RP</small></div></div>
      <div class="loading"><i></i></div>`;
    Audio.ui('start');
    await sleep(2200);
    if (UI.current !== this) return;
    if (!p.cars.length) UI.go('carselect', { mode: 'register' });
    else UI.go('start');
  },
});
