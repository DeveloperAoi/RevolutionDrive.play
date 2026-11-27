// DEVELOPER MENU — testing tools for the game's owner (credits, TP, CP, parts, cars, courses, story, debug view)
// Hidden by default: tap the version number in UPDATE LOG 7 times (or open the game with ?dev) to show it in CONFIG.
// Optional owner lock: put your Firebase account UID(s) in DEV_OWNER_UIDS — then only those signed-in accounts see it.
// Note: saves live on the player's device / their own cloud slot, so this menu is a convenience, not a security boundary.
import { UI, $, $$, esc, toast, dialog } from './core.js';
import { App } from '../app.js';
import { Save } from '../core/save.js';
import { Audio } from '../audio/audio.js';
import { backdrop, plate, consoleBox, logoMark, keyGuide } from './frame.js';
import { CARS, MAX_GARAGE } from '../data/cars.js';
import { COURSES } from '../data/courses.js';
import { AERO, WHEEL_DESIGNS, VINYL_SLOTS } from '../data/custom.js';
import { allEpisodes } from '../data/story.js';
import { addTokens, accState } from '../data/accessories.js';

export const DEV_OWNER_UIDS = []; // e.g. ['abc123yourFirebaseUid'] — empty = anyone who unlocks developer mode

const FLAG = 'rd_devmode';
export const devAllowed = () => !DEV_OWNER_UIDS.length || (Save.mode === 'account' && DEV_OWNER_UIDS.includes(Save.uid));
export const devEnabled = () => {
  if (/[?&]dev\b/.test(location.search)) { try { sessionStorage.setItem(FLAG, '1'); } catch { /* private mode */ } }
  let on = false; try { on = sessionStorage.getItem(FLAG) === '1' || localStorage.getItem(FLAG) === '1'; } catch { /* storage blocked */ }
  return on && devAllowed();
};
export function setDevMode(on) { try { if (on) localStorage.setItem(FLAG, '1'); else { localStorage.removeItem(FLAG); sessionStorage.removeItem(FLAG); } } catch { /* storage blocked */ } }

const P = () => Save.profile;
const save = async (what) => { Save.touch('dev'); await Save.persistNow('dev'); Audio.ui('coin'); toast(what); };

UI.register({
  id: 'devmenu',
  build(n) {
    n.innerHTML = `${backdrop([[640, 24], [1896, 24], [1896, 960], [430, 960]], { tone: '#c9c3b3' })}
      <div class="af-title" style="left:760px;top:34px"><div class="t">DEVELOPER</div><div style="font-family:var(--jp);font-weight:900;font-size:24px;color:#ffd400;text-shadow:0 2px 0 #000">開発者メニュー — テスト用。変更はこのプロフィールのセーブに保存されます</div></div>
      <div class="pp"></div><div class="dv-list"></div><div class="dv-info"></div>
      <div class="cbx"></div>${logoMark()}${keyGuide([['ud', '項目'], ['lr', '選択'], ['ok', '実行'], ['back', '戻る']])}`;
  },
  enter() {
    if (!devEnabled()) { toast('開発者メニューは無効です'); return UI.go('config'); }
    this.i = 0; this.carIdx = 0; this.amt = { credits: 1, tp: 0, cp: 0 };
    this.render();
  },
  items() {
    const p = P(), A = accState(p);
    const credits = [10000, 100000, 1000000, 10000000], tps = [10, 100, 1000], cps = [1, 10, 100];
    const car = CARS[this.carIdx];
    return [
      { k: 'credits', jp: 'クレジットを追加', val: `+¥${credits[this.amt.credits].toLocaleString()}`, cur: `所持 ¥${p.credits.toLocaleString()}`, lr: (d) => { this.amt.credits = (this.amt.credits + d + credits.length) % credits.length; },
        run: () => { p.credits += credits[this.amt.credits]; return save(`¥${credits[this.amt.credits].toLocaleString()} 追加しました`); } },
      { k: 'reset', jp: 'クレジットを設定', val: '¥0 / ¥5,000 / ¥999,999,999', cur: '決定で選択', run: async () => {
          const v = await dialog.confirm('クレジットを設定', '¥999,999,999 にしますか?(キャンセルで ¥5,000 に戻す)', '¥999,999,999', '¥5,000');
          p.credits = v ? 999999999 : 5000; return save(`クレジットを ¥${p.credits.toLocaleString()} にしました`); } },
      { k: 'tp', jp: 'チューニングポイント(TP)', val: `+${tps[this.amt.tp]} TP`, cur: `所持 ${p.tp} TP`, lr: (d) => { this.amt.tp = (this.amt.tp + d + tps.length) % tps.length; },
        run: () => { p.tp += tps[this.amt.tp]; return save(`${tps[this.amt.tp]} TP 追加しました`); } },
      { k: 'cp', jp: 'カスタマイズポイント(CP)', val: `+${cps[this.amt.cp]} CP`, cur: `所持 ${A.cp} CP / トークン ${A.ct}`, lr: (d) => { this.amt.cp = (this.amt.cp + d + cps.length) % cps.length; },
        run: () => { addTokens(p, cps[this.amt.cp] * 100); return save(`${cps[this.amt.cp]} CP 追加しました`); } },
      { k: 'parts', jp: '全パーツを所持', val: 'エアロ・ホイール・ステッカー', cur: `${Object.keys(p.inventory || {}).length} 個所持`, run: () => {
          p.inventory ||= {};
          for (const [cat, def] of Object.entries(AERO)) for (const it of def.list) p.inventory[`${cat}:${it.id}`] = true;
          for (const w of WHEEL_DESIGNS) p.inventory[`wheel:${w.id}`] = true;
          for (const sl of Object.values(VINYL_SLOTS)) for (const d of sl.designs) p.inventory[`vinyl:${d}`] = true;
          return save('全パーツを所持しました'); } },
      { k: 'car', jp: '車をガレージに追加', val: `◀ ${car.maker} ${car.name} ▶`, cur: `ガレージ ${p.cars.length}/${MAX_GARAGE}`, lr: (d) => { this.carIdx = (this.carIdx + d + CARS.length) % CARS.length; },
        run: () => { if (!Save.canAddCar()) { Audio.ui('error'); return toast(`ガレージが満杯です(${MAX_GARAGE}台)`); } Save.addCar(car.id); return save(`${car.name} を追加しました`); } },
      { k: 'courses', jp: '全コースを解放', val: `${COURSES.length} コース`, cur: `解放済み ${(p.unlocked?.courses || []).length}`, run: () => { p.unlocked ||= {}; p.unlocked.courses = COURSES.map(c => c.id); return save('全コースを解放しました'); } },
      { k: 'story', jp: 'ストーリー全話を解放', val: 'シーズン1 全エピソード', cur: `クリア ${Object.keys(p.story?.cleared || {}).length} 話`, run: () => {
          p.story ||= { cleared: {}, pts: 0, plays: 0 };
          for (const { ep } of allEpisodes()) p.story.cleared[ep.id] = true;
          return save('ストーリーを全話解放しました'); } },
      { k: 'debug', jp: '車両デバッグ表示', val: App.debug ? 'ON' : 'OFF', cur: 'レース中に向き・速度・ドリフト角を表示(F9でも切替)', lr: () => { App.debug = !App.debug; },
        run: () => { App.debug = !App.debug; Audio.ui('ok'); toast(`車両デバッグ表示 ${App.debug ? 'ON' : 'OFF'}`); } },
      { k: 'off', jp: '開発者モードを終了', val: 'CONFIGから非表示にする', cur: '', run: () => { setDevMode(false); App.debug = false; Audio.ui('back'); toast('開発者モードを終了しました'); UI.go('config'); } },
    ];
  },
  render() {
    const its = this.items(); this.its = its;
    $('.pp', this.el).innerHTML = plate(); $('.cbx', this.el).innerHTML = consoleBox();
    $('.dv-list', this.el).innerHTML = its.map((it, k) => `<div class="dv-row${k === this.i ? ' on' : ''}" data-k="${k}"><b>${esc(it.jp)}</b><span>${esc(it.val)}</span><small>${esc(it.cur)}</small></div>`).join('');
    $$('.dv-row', this.el).forEach(r => r.onclick = () => { const k = +r.dataset.k; if (k === this.i) this.onAction('ok'); else { this.i = k; Audio.ui('move'); this.render(); } });
    $('.dv-info', this.el).innerHTML = `<b>開発者メニューの表示</b>アップデート履歴のバージョン番号を7回タップ、または URL に <code>?dev</code> を付けて開くと CONFIG に表示されます。${DEV_OWNER_UIDS.length ? '<br>このメニューは登録されたオーナーアカウントだけが使えます。' : '<br>オーナー限定にするには js/ui/screens-dev.js の DEV_OWNER_UIDS に自分のアカウントUIDを入れてください。'}`;
  },
  async onAction(a) {
    const it = this.its?.[this.i];
    if (a === 'back') { Audio.ui('back'); return UI.go('config'); }
    if (a === 'up' || a === 'down') { this.i = (this.i + (a === 'up' ? -1 : 1) + this.its.length) % this.its.length; Audio.ui('move'); return this.render(); }
    if ((a === 'left' || a === 'right') && it?.lr) { it.lr(a === 'left' ? -1 : 1); Audio.ui('move'); return this.render(); }
    if (a === 'ok' && it) { await it.run(); if (UI.current === this) this.render(); }
  },
});
