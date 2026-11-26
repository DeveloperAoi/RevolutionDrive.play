// ACCESSORY CUSTOMIZE / SHOP (cups, titles, SP paints) and the REWARD LIST (報酬一覧)
import { UI, $, $$, esc, dialog, toast, startTimer, stopTimer } from './core.js';
import { backdrop, plate, consoleBox, logoMark, keyGuide, kgIcon } from './frame.js';
import { App } from '../app.js';
import { Audio } from '../audio/audio.js';
import { Save } from '../core/save.js';
import { ACC_CATS, ACCESSORIES, accById, accState, accIcon, cupSVG, TOKENS_PER_POINT } from '../data/accessories.js';

let clk = null;
function clock(node, secs, onZero) {
  clearInterval(clk); if (!node) return;
  if (!App.settings.custTimer) { node.querySelector('b').textContent = 'NO TIME LIMIT'; return; }
  let left = secs; const draw = () => { node.querySelector('b').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; };
  draw(); clk = setInterval(() => { left--; draw(); if (left <= 0) { clearInterval(clk); onZero && onZero(); } }, 1000);
}
const cpBox = () => { const a = accState(Save.profile); return `<div class="ac-cp"><span class="l">CUSTOMIZE POINT</span><b>${a.cp}</b><small>CP</small><span class="t">トークン ${a.ct} / ${TOKENS_PER_POINT}</span><i style="width:${a.ct}%"></i></div>`; };

UI.register({
  id: 'acccustom',
  build(n) {
    n.innerHTML = `${backdrop([[700, 24], [1896, 24], [1896, 600], [520, 600]], { tone: '#cfc8b6' })}
      <div class="ac-art"></div>
      <div class="af-title" style="left:50%;top:24px;transform:translateX(-30%);text-align:center"><div class="t ac-t"></div><div class="timer af-tm ac-tm" style="text-align:center"><b>3:00</b></div></div>
      <div class="pp"></div><div class="ac-now"></div><div class="ac-name"></div><div class="ac-cpbox"></div>
      <div class="ac-cats"></div>
      <div class="hintbar ac-hint" style="top:610px"></div>
      <div class="ac-strip"><div class="ac-row"></div></div>
      <div class="cbx"></div>${logoMark()}${keyGuide([['lr', '選択'], ['ud', 'カテゴリ'], ['ok', '決定'], ['back', '戻る']])}`;
  },
  enter(params = {}) {
    this.mode = params.mode || 'custom'; this.ci = Math.max(0, ACC_CATS.findIndex(c => c.id === (params.cat || 'cup')));
    App.gfx.setView(null);
    $('.pp', this.el).innerHTML = plate();
    this.render(0);
    clock($('.ac-tm', this.el), 180, () => this.exit());
    Audio.playMusic('menu');
  },
  leave() { clearInterval(clk); },
  items() {
    const cat = ACC_CATS[this.ci], a = accState(Save.profile);
    const list = ACCESSORIES.filter(it => it.cat === cat.id && (this.mode === 'shop' ? (!it.reward || a.owned[it.id]) : a.owned[it.id]));
    return this.mode === 'custom' && cat.id !== 'spcolor' ? [null, ...list] : list;
  },
  render(i = this.i || 0) {
    const cat = ACC_CATS[this.ci], a = accState(Save.profile), items = this.items();
    this.i = Math.max(0, Math.min(items.length - 1, i));
    $('.ac-t', this.el).textContent = this.mode === 'shop' ? 'ACCESSORY SHOP' : cat.title;
    $('.ac-hint', this.el).textContent = items.length ? (this.mode === 'shop' ? 'カスタマイズポイントで購入できます(ショップ限定)' : cat.ask) : (this.mode === 'shop' ? '' : 'まだ持っていません。ショップで購入するか、報酬で獲得できます');
    $('.ac-cats', this.el).innerHTML = ACC_CATS.map((c, k) => `<b class="${k === this.ci ? 'on' : ''}" data-k="${k}">${c.jp}</b>`).join('');
    $$('.ac-cats b', this.el).forEach(b => b.onclick = () => { this.ci = +b.dataset.k; Audio.ui('move'); this.render(0); });
    $('.ac-cpbox', this.el).innerHTML = cpBox(); $('.cbx', this.el).innerHTML = consoleBox();
    const eq = a.eq[cat.id] || null;
    $('.ac-now', this.el).innerHTML = `<div class="hd">${cat.now}</div><div class="ic">${cat.id === 'spcolor' ? '' : accIcon(accById(eq), 150)}</div><div class="nm">${cat.id === 'spcolor' ? 'ドレスアップ → ボディカラー' : esc(accById(eq)?.name || '装着なし')}</div>`;
    $('.ac-row', this.el).innerHTML = items.map((it, k) => {
      const own = it ? a.owned[it.id] : true, on = (it ? it.id : null) === eq && cat.id !== 'spcolor';
      return `<div class="acard ${k === this.i ? 'sel' : ''}" data-k="${k}">${on ? '<div class="eq">装着中</div>' : ''}<div class="ic">${it ? accIcon(it, 96) : '<b class="none">—</b>'}</div><div class="lab">${esc(it ? it.name : '装着なし')}</div>${this.mode === 'shop' && it ? `<div class="pr ${own ? 'own' : ''}">${own ? '所持' : it.cost + ' CP'}</div>` : ''}</div>`;
    }).join('') || '<div class="ac-empty">アイテムがありません</div>';
    $$('.ac-row .acard', this.el).forEach(c => c.onclick = () => { const k = +c.dataset.k; if (k === this.i) return this.pick(); this.i = k; Audio.ui('move'); this.render(); });
    const row = $('.ac-row', this.el); row.style.transform = `translateX(${-Math.max(0, this.i - 2) * 300}px)`;
    const cur = items[this.i];
    $('.ac-art', this.el).innerHTML = cur !== undefined ? `<div class="big">${cur ? accIcon(cur, 300) : '<b class="none">装着なし</b>'}</div>` : '';
    $('.ac-name', this.el).innerHTML = cur !== undefined ? `<span>${esc(cur ? cur.name : '装着なし')}</span>` : '';
  },
  async pick() {
    const cat = ACC_CATS[this.ci], a = accState(Save.profile), it = this.items()[this.i];
    if (it === undefined) return;
    if (this.mode === 'shop') {
      if (!it || a.owned[it.id]) { Audio.ui('error'); return toast('購入済みです(カスタマイズで付け替えできます)'); }
      if (a.cp < it.cost) { Audio.ui('error'); return dialog.alert('ポイント不足', `${esc(it.name)} には ${it.cost} CP 必要です(所持 ${a.cp} CP)。<br>カスタマイズトークンを${TOKENS_PER_POINT}個集めるごとに1 CPになります。<br>ストーリーをクリアすると大量に獲得できます!`); }
      if (!(await dialog.confirm('購入', `<div style="display:grid;place-items:center">${accIcon(it, 140)}</div><b>${esc(it.name)}</b> を ${it.cost} CP で購入しますか?`, '購入する', 'やめる'))) return;
      a.cp -= it.cost; a.owned[it.id] = true; if (cat.id !== 'spcolor' && !a.eq[cat.id]) a.eq[cat.id] = it.id;
      await Save.persistNow('acc-buy'); Audio.ui('coin'); toast(`${it.name} を購入しました`); return this.render();
    }
    if (cat.id === 'spcolor') { Audio.ui('ok'); return toast('ドレスアップのボディカラーで選択できます'); }
    a.eq[cat.id] = it ? it.id : null; Save.touch('acc'); Audio.ui('ok'); toast(it ? `${it.name} を装着しました` : '取り外しました');
    $('.pp', this.el).innerHTML = plate(); this.render();
  },
  async exit() { clearInterval(clk); await Save.persistNow('acc'); UI.go(App.takeReturn(this.mode === 'shop' ? 'shop' : 'garage')); },
  onAction(a) {
    if (a === 'back') { Audio.ui('back'); return this.exit(); }
    if (a === 'up' || a === 'down') { this.ci = (this.ci + (a === 'up' ? -1 : 1) + ACC_CATS.length) % ACC_CATS.length; Audio.ui('move'); return this.render(0); }
    if (a === 'left' || a === 'right') { const n = this.items().length; if (!n) return; this.i = (this.i + (a === 'left' ? -1 : 1) + n) % n; Audio.ui('move'); return this.render(); }
    if (a === 'ok') return this.pick();
  },
});

// ───────── REWARD LIST ─────────
export function goWithRewards(id, params = {}) {
  const p = Save.profile; const a = p && accState(p);
  if (a && a.pending.length) return UI.go('rewards', { then: [id, params] });
  return UI.go(id, params);
}
UI.register({
  id: 'rewards',
  build(n) {
    n.innerHTML = `<div class="rw-bg"></div><div class="rw-head"><b>報酬一覧</b><span class="rw-count"></span></div>
      <div class="rw-box"><div class="rw-grid"></div><div class="rw-note"><em>最大所持数を超えて獲得した報酬は、キャッシュに変換します</em><span>${wrench()} ショップ&カスタマイズで付け替えができます</span></div></div>
      <div class="cbx"></div>${keyGuide([['ud', 'スクロール'], ['ok', '次へ']])}`;
  },
  enter(params = {}) {
    this.then = params.then || ['start', {}];
    const a = accState(Save.profile); this.list = a.pending.slice(); a.pending.length = 0; Save.touch('rewards');
    $('.rw-count', this.el).textContent = `${this.list.length}個受け取りました`;
    $('.cbx', this.el).innerHTML = consoleBox();
    $('.rw-grid', this.el).innerHTML = this.list.map(r => { const it = accById(r.id); return `<div class="rw-it">${wrench()}<div class="ic">${it.cat === 'title' ? titleIcon() : accIcon(it, 110)}</div><div class="tx"><div class="nm">${{ cup: 'カップ', title: '称号', spcolor: 'ボディカラー' }[it.cat]} ${esc(it.name)}</div><div class="why">${esc(r.why || '')}${r.cash ? ` <b>(所持済み → ¥${r.cash})</b>` : ''}</div></div></div>`; }).join('');
    this.scroll = 0; App.gfx.setView(null);
    Audio.ui('coin');
    clearTimeout(this.to); this.to = setTimeout(() => { if (UI.current === this) this.next(); }, 20000);
  },
  leave() { clearTimeout(this.to); },
  next() { clearTimeout(this.to); Audio.ui('ok'); UI.go(this.then[0], this.then[1]); },
  onAction(a) {
    const g = $('.rw-grid', this.el);
    if (a === 'up' || a === 'down') { this.scroll = Math.max(0, Math.min(g.scrollHeight - g.clientHeight, this.scroll + (a === 'up' ? -140 : 140))); g.scrollTop = this.scroll; return; }
    if (a === 'ok' || a === 'back') return this.next();
  },
});
function wrench() { return '<svg class="wr" viewBox="0 0 30 30" width="30" height="30"><path d="M6 24 L16 14 C14 9 18 4 23 5 L19 9 L21 11 L25 7 C26 12 21 16 16 14 L6 24Z" fill="#4ab8ff" stroke="#0a3a7a" stroke-width="1.5"/></svg>'; }
function titleIcon() { return '<svg viewBox="0 0 120 70" width="120" height="70"><rect x="6" y="18" width="108" height="34" rx="3" fill="#2a2c30" stroke="#999" stroke-width="2"/><path d="M14 24 H106 L100 46 H20Z" fill="#e0b020"/><path d="M40 28 L60 42 L80 28" stroke="#fff" stroke-width="3" fill="none"/></svg>'; }
export { cupSVG };
