// UI framework: stage scaling, screen manager, focus navigation, dialogs, shared widgets
import { Input } from '../core/input.js';
import { Audio } from '../audio/audio.js';
import { Save, rankOf, RANK_COLORS } from '../core/save.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- stage scaling (16:9 virtual 1920x1080) ----
export function fitStage() {
  const st = $('#stage'); const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  // screens flagged "wide" (race HUD) stretch the stage to the full width of wider-than-16:9 phones
  const w = UI.current && UI.current.wide && innerWidth / innerHeight > 16 / 9 ? Math.round(innerWidth / s) : 1920;
  st.style.width = w + 'px';
  st.style.transform = `scale(${s})`;
}

// ---- screens ----
export const UI = {
  screens: {}, current: null, stack: [], busy: false,
  register(def) {
    const node = el(`<section class="screen" id="scr-${def.id}"></section>`);
    $('#stage').insertBefore(node, $('#wipe'));
    def.el = node; this.screens[def.id] = def;
    if (def.build) def.build(node);
  },
  async go(id, params = {}, { wipe = true, push = false } = {}) {
    if (this.busy) return; this.busy = true;
    const next = this.screens[id]; const prev = this.current;
    if (wipe) { const w = $('#wipe'); w.classList.remove('run'); void w.offsetWidth; w.classList.add('run'); Audio.whoosh(0.5); await sleep(330); }
    if (prev) { prev.el.classList.remove('active'); prev.leave && prev.leave(); stopTimer(); }
    if (push && prev) this.stack.push(prev.id);
    this.current = next; fitStage();
    Input.menuHandler = (a, e) => { Audio.unlock(); if (dialog.open) return dialog.onAction(a); next.onAction && next.onAction(a, e); };
    next.el.classList.add('active');
    this.busy = false;
    try { Promise.resolve(next.enter && next.enter(params)).catch(e => { console.error(e); toast('エラー: ' + e.message); }); } catch (e) { console.error(e); toast('エラー: ' + e.message); }
  },
};
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---- focus groups: keyboard/gamepad/mouse navigation over a set of elements ----
export class Focus {
  constructor(items, { axis = 'h', cols = 1, wrap = true, onChange, onSelect, index = 0, sound = true } = {}) {
    this.items = items; this.axis = axis; this.cols = cols; this.wrap = wrap; this.onChange = onChange; this.onSelect = onSelect; this.sound = sound;
    this.i = Math.min(index, items.length - 1);
    items.forEach((it, k) => {
      it.classList.add('focusable');
      it.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) this.set(k); });
      it.addEventListener('click', (e) => { e.stopPropagation(); Audio.unlock(); this.set(k, false); this.select(); });
    });
    this.apply();
  }
  apply() { this.items.forEach((it, k) => it.classList.toggle('focus', k === this.i)); }
  set(k, snd = true) {
    if (k === this.i || k < 0 || k >= this.items.length) return;
    this.i = k; this.apply(); if (snd && this.sound) Audio.ui('move'); this.onChange && this.onChange(k, this.items[k]);
  }
  move(d) {
    let k = this.i + d; const n = this.items.length;
    if (this.wrap) k = (k + n) % n; else k = Math.max(0, Math.min(n - 1, k));
    this.set(k);
  }
  action(a) {
    const n = this.items.length;
    if (this.axis === 'h') { if (a === 'left') return this.move(-1), true; if (a === 'right') return this.move(1), true; }
    if (this.axis === 'v') { if (a === 'up') return this.move(-1), true; if (a === 'down') return this.move(1), true; }
    if (this.axis === 'grid') {
      const c = this.cols;
      if (a === 'left') return this.move(-1), true; if (a === 'right') return this.move(1), true;
      if (a === 'up') { if (this.i - c >= 0) this.set(this.i - c); return true; }
      if (a === 'down') { if (this.i + c < n) this.set(this.i + c); else this.set(n - 1); return true; }
    }
    if (a === 'ok') { this.select(); return true; }
    return false;
  }
  select() { const it = this.items[this.i]; if (it && it.hasAttribute('disabled')) { Audio.ui('error'); return; } this.onSelect && this.onSelect(this.i, it); }
  get el() { return this.items[this.i]; }
}

// ---- modal dialog (confirm / alert / prompt) ----
export const dialog = {
  open: false, focus: null, node: null,
  show({ title = '', text = '', buttons = [{ label: 'OK', value: true, cls: 'primary' }], html = '' }) {
    return new Promise(res => {
      this.close();
      const n = this.node = el(`<div class="screen active" style="z-index:800;background:rgba(0,0,0,.72)">
        <div class="modal" style="width:1000px;text-align:center">
          ${title ? `<h2 style="color:var(--orange2)">${esc(title)}</h2>` : ''}
          <div class="sub" style="font-size:30px;line-height:46px;color:#eee">${text}</div>${html}
          <div class="row" style="justify-content:center;margin-top:20px">${buttons.map(b => `<button class="btn ${b.cls || ''}">${esc(b.label)}</button>`).join('')}</div>
        </div></div>`);
      $('#stage').appendChild(n); this.open = true;
      const btns = $$('.btn', n);
      this.focus = new Focus(btns, { axis: 'h', index: buttons.findIndex(b => b.focus) >= 0 ? buttons.findIndex(b => b.focus) : 0, onSelect: (i) => { Audio.ui(buttons[i].value === false || buttons[i].value == null ? 'back' : 'ok'); this.close(); res(buttons[i].value); } });
      this._cancel = () => { const c = buttons.find(b => b.cancel) || buttons[buttons.length - 1]; Audio.ui('back'); this.close(); res(c.value); };
      Audio.ui('ok');
    });
  },
  onAction(a) { if (!this.focus) return; if (a === 'back') return this._cancel(); this.focus.action(a); },
  close() { if (this.node) { this.node.remove(); this.node = null; } this.open = false; this.focus = null; },
  confirm(title, text, yes = 'YES', no = 'NO') { return this.show({ title, text, buttons: [{ label: yes, value: true, cls: 'blue' }, { label: no, value: false, cls: 'dark', cancel: true, focus: true }] }); },
  alert(title, text) { return this.show({ title, text, buttons: [{ label: 'OK', value: true, cls: 'primary' }] }); },
};

export function toast(msg, ms = 2400) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms);
}

// ---- arcade select timer ----
let timerH = null;
export function startTimer(node, secs, onZero) {
  stopTimer(); if (!node) return;
  let left = secs; node.classList.remove('warn');
  const draw = () => { node.querySelector('b').textContent = String(left).padStart(2, '0'); node.classList.toggle('warn', left <= 10); };
  draw();
  timerH = setInterval(() => { left--; if (left <= 10 && left > 0) Audio.blip(660, 0.04, 'square', 0.05); draw(); if (left <= 0) { stopTimer(); onZero && onZero(); } }, 1000);
}
export function stopTimer() { clearInterval(timerH); timerH = null; }

// ---- player avatar (original helmet emblem) ----
const ICON_COLORS = [['#ff7a00', '#ffd400'], ['#1e8cff', '#36c3ff'], ['#ff2a3a', '#ff9a9a'], ['#3dff8a', '#0f7a3a'], ['#b06aff', '#4a1a8a'], ['#f2f2f2', '#888'], ['#ffd400', '#222'], ['#00e0d0', '#004a60']];
export const ICON_COUNT = ICON_COLORS.length;
export function avatarSVG(i = 0, size = 120) {
  const [a, b] = ICON_COLORS[i % ICON_COLORS.length];
  return `<svg width="${size}" height="${size}" viewBox="0 0 120 120"><defs><linearGradient id="ag${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2e35"/><stop offset="1" stop-color="#0b0c0f"/></linearGradient></defs>
  <rect width="120" height="120" rx="14" fill="url(#ag${i})"/><path d="M0 92 L120 60 V120 H0Z" fill="${b}" opacity=".25"/>
  <path d="M24 74 C22 40 44 22 66 22 C90 22 102 42 100 66 L100 84 L60 90 L30 88 Z" fill="${a}" stroke="#111" stroke-width="4"/>
  <path d="M52 50 L98 48 L98 70 L56 72 Z" fill="#111" stroke="#ddd" stroke-width="2"/><path d="M60 54 L92 53" stroke="${b}" stroke-width="4" opacity=".8"/>
  <path d="M30 70 C40 60 54 60 60 64" stroke="${b}" stroke-width="6" fill="none"/><text x="40" y="44" font-family="Arial Black" font-size="16" font-style="italic" fill="#111">R</text></svg>`;
}

export function rankBadge(rp, size = 90) {
  const r = rankOf(rp); const c = RANK_COLORS[r.ci];
  return `<div class="rankb" style="display:inline-grid;place-items:center;width:${size}px;height:${size}px;background:linear-gradient(180deg,#fff,#d8dce1);border:3px solid #888;border-radius:10px;box-shadow:inset 0 0 0 3px #fff">
    <span style="font-style:italic;font-size:${size * 0.55}px;line-height:1;color:${c};-webkit-text-stroke:2px #222;">${r.cls}<small style="font-size:${size * 0.32}px;color:#ff7a00">${r.level}</small></span></div>`;
}

// top-left player plate used on select screens
export function playerPlate() {
  const p = Save.profile; if (!p) return '';
  return `<div class="pplate" style="position:absolute;left:0;top:0;width:640px;height:150px;display:flex;align-items:center;gap:20px;padding:0 30px 0 26px;background:linear-gradient(180deg,#f4f6f8,#c3c8cf);color:#111;clip-path:polygon(0 0,100% 0,93% 100%,0 100%);box-shadow:0 6px 0 #000;z-index:5">
    <div style="border:3px solid #222;border-radius:14px;overflow:hidden;width:110px;height:110px">${avatarSVG(p.icon, 110)}</div>
    <div style="flex:1;min-width:0"><div style="font-size:16px;color:#c00;letter-spacing:2px">${Save.mode === 'account' ? 'ACCOUNT' : 'GUEST'} · TEAM</div>
      <div style="font-family:var(--jp);font-weight:900;font-size:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.teamName || '---')}</div>
      <div style="font-size:44px;font-style:italic;line-height:48px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.driverName || 'DRIVER')}</div></div>
    ${rankBadge(p.rp, 96)}</div>`;
}
export function consolePlate() {
  const p = Save.profile; if (!p) return '';
  return `<div class="console" style="position:absolute;left:30px;top:180px;width:520px;padding:10px 18px;background:rgba(6,8,12,.9);border:2px solid #444;border-radius:8px;font-style:italic;z-index:5">
    <div style="display:flex;justify-content:space-between;font-size:30px"><span style="color:#888;font-size:18px;letter-spacing:2px">CREDITS</span><span class="credits">¥${p.credits.toLocaleString()}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:24px"><span style="color:#888;font-size:18px;letter-spacing:2px">GARAGE</span><span>${p.cars.length} / 5</span><span style="color:#888;font-size:18px;letter-spacing:2px">RACES</span><span>${p.stats.races}</span></div></div>`;
}
export function footer(keys) {
  const p = Save.profile;
  const sync = { local: ['LOCAL SAVE', 'local'], saving: ['SAVING…', 'pending'], synced: ['CLOUD SYNCED', 'ok'], pending: ['SYNC PENDING', 'pending'], error: ['SYNC ERROR', 'err'] }[Save.status] || ['', ''];
  return `<div class="footer">${keys.map(([k, t]) => `<span><span class="key">${k}</span>${t}</span>`).join('')}
    <div class="player">${p ? `<span class="sync ${sync[1]}" data-sync>${sync[0]}</span>` : ''}</div></div>`;
}
export function refreshSync() {
  const sync = { local: ['LOCAL SAVE', 'local'], saving: ['SAVING…', 'pending'], synced: ['CLOUD SYNCED', 'ok'], pending: ['SYNC PENDING', 'pending'], error: ['SYNC ERROR', 'err'] }[Save.status] || ['', ''];
  $$('[data-sync]').forEach(n => { n.textContent = sync[0]; n.className = 'sync ' + sync[1]; });
}
