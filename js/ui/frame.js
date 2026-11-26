// Arcade frame widgets shared by MODE / CAR / GARAGE / COURSE / DRESS UP / WHEEL / METER / TUNING
// All artwork is original: screentone backdrop, car silhouette icons, fictional brand wordmarks.
import { Save, rankOf } from '../core/save.js';
import { esc, avatarSVG, rankBadge } from './core.js';
import { PART_BRANDS, WHEEL_BRANDS } from '../data/custom.js';

// full-stage screentone backdrop with a slanted window (hole) where the 3D view shows through
export function backdrop(hole = [[620, 40], [1890, 40], [1890, 700], [520, 700]], { tone = '#d8d0bc', frame = true } = {}) {
  const P = hole.map(p => p.join(',')).join(' ');
  const d = `M0 0H1920V1080H0Z M${hole.map(p => p.join(' ')).join(' L')} Z`;
  return `<svg class="af-bd" viewBox="0 0 1920 1080" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">
    <defs>
      <pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(25)"><circle cx="4.5" cy="4.5" r="1.5" fill="rgba(60,50,30,.28)"/></pattern>
      <pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="14" height="2" fill="rgba(60,50,30,.10)"/></pattern>
      <linearGradient id="vig" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgba(255,255,255,.25)"/><stop offset="1" stop-color="rgba(40,30,10,.35)"/></linearGradient>
      <radialGradient id="burst" cx="0.18" cy="0.62" r="0.6"><stop offset="0" stop-color="rgba(255,255,255,.55)"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></radialGradient>
    </defs>
    <path d="${d}" fill-rule="evenodd" fill="${tone}"/>
    <path d="${d}" fill-rule="evenodd" fill="url(#dots)"/>
    <path d="${d}" fill-rule="evenodd" fill="url(#hatch)"/>
    <path d="${d}" fill-rule="evenodd" fill="url(#burst)"/>
    <path d="${d}" fill-rule="evenodd" fill="url(#vig)"/>
    ${speedStreaks()}
    ${frame ? `<polygon points="${P}" fill="none" stroke="#1d2026" stroke-width="16"/><polygon points="${P}" fill="none" stroke="#9aa1aa" stroke-width="3"/>` : ''}
  </svg>`;
}
function speedStreaks() {
  let s = ''; let seed = 7; const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 26; i++) { const y = r() * 1080, x = r() * 700 - 200, l = 200 + r() * 600; s += `<path d="M${x} ${y} L${x + l} ${y - l * 0.36}" stroke="rgba(40,30,10,${0.06 + r() * 0.08})" stroke-width="${1 + r() * 3}"/>`; }
  return s;
}

// top-left player plate (white card, avatar, name, rank)
export function plate() {
  const p = Save.profile; if (!p) return '';
  return `<div class="af-plate"><div class="av">${avatarSVG(p.icon, 128)}</div>
    <div class="nm"><div class="team">${Save.mode === 'account' ? 'ACCOUNT' : 'GUEST'} · ${esc(p.teamName || '---')}</div><div class="drv">${esc(p.driverName || 'DRIVER')}</div><div class="aff">所属 ${esc(p.teamName || '未所属')}</div></div>
    <div class="rk">${rankBadge(p.rp, 100)}</div></div>`;
}

// bottom-left console with credits, garage count, tune points
export function consoleBox() {
  const p = Save.profile; if (!p) return '';
  return `<div class="af-console"><div class="lbl">R-Console</div>
    <div class="row1"><span class="ic">¥</span><b class="num">${p.credits.toLocaleString()}</b></div>
    <div class="row2"><span class="ic car">🚗</span><b class="num s">${p.cars.length}/5</b><span class="ic">TP</span><b class="num s">${p.tp ?? 0}</b></div></div>`;
}

export function logoMark() {
  return `<div class="af-logo"><div class="l1">REV<em>O</em>LUTION</div><div class="l2">DRIVE</div></div>`;
}
export function keyGuide(items = [['dpad', '選択'], ['ok', '決定'], ['back', '戻る']]) {
  const ic = { dpad: '<i class="kg dpad">✚</i>', ok: '<i class="kg ok">ENTER</i>', back: '<i class="kg back">ESC</i>', lr: '<i class="kg dpad">⇆</i>', ud: '<i class="kg dpad">⇅</i>' };
  return `<div class="af-keys">${items.map(([k, t]) => `<span>${ic[k] || ''}${t}</span>`).join('')}</div>`;
}
export function titleTimer(title, timerId = 'af-timer') {
  return `<div class="af-title"><div class="t">${title}</div><div class="timer af-tm" id="${timerId}"><b>3:00</b></div></div>`;
}

// generic car silhouette icon with a highlighted zone
export function carIcon(zone = 'body', hl = '#3dbb4a') {
  const base = '#9aa0a8', z = (k) => zone === k ? hl : 'none';
  return `<svg viewBox="0 0 200 90" width="170" height="77">
    <path d="M14 62 L20 44 L58 38 L82 18 L140 16 L168 38 L188 44 L190 62 Z" fill="${zone === 'body' ? hl : base}" stroke="#333" stroke-width="3"/>
    <path d="M86 22 L136 20 L156 38 L74 40 Z" fill="#e8edf2" stroke="#333" stroke-width="2"/>
    ${zone === 'vinyl' ? '<path d="M24 50 L180 46 L182 54 L22 58Z" fill="#ffd400"/>' : ''}
    <path d="M166 50 L192 50 L194 64 L170 64Z" fill="${z('front')}"/>
    <path d="M8 50 L30 50 L28 64 L8 64Z" fill="${z('rear')}"/>
    <path d="M150 34 L186 42 L186 47 L148 40Z" fill="${z('hood')}"/>
    <path d="M44 60 L156 60 L156 66 L44 66Z" fill="${z('side')}"/>
    ${zone === 'wing' ? `<path d="M6 24 L44 24 L44 30 L6 30Z M18 30 L22 40 M34 30 L32 40" fill="${hl}" stroke="${hl}" stroke-width="4"/>` : ''}
    ${zone === 'muffler' ? `<rect x="2" y="60" width="16" height="7" rx="3" fill="${hl}"/>` : ''}
    ${zone === 'meter' ? `<circle cx="100" cy="45" r="30" fill="#222" stroke="${hl}" stroke-width="5"/><path d="M100 45 L118 30" stroke="#f33" stroke-width="4"/>` : ''}
    <circle cx="52" cy="64" r="15" fill="${zone === 'wheel' ? hl : '#333'}" stroke="#222" stroke-width="3"/><circle cx="52" cy="64" r="6" fill="#ccc"/>
    <circle cx="152" cy="64" r="15" fill="${zone === 'wheel' ? hl : '#333'}" stroke="#222" stroke-width="3"/><circle cx="152" cy="64" r="6" fill="#ccc"/>
    ${zone === 'height' ? `<path d="M100 2 L108 12 L92 12Z M100 88 L108 78 L92 78Z" fill="${hl}"/>` : ''}
  </svg>`;
}

// original brand wordmarks for part tiles (fictional brands)
export function brandMark(key, sub = '') {
  const b = PART_BRANDS[key] || WHEEL_BRANDS[key];
  if (!b || key === 'NORMAL') return `<div class="bm plain">Normal</div>`;
  const style = b.style || 'slant';
  if (style === 'bolt') return `<div class="bm" style="color:${b.color}"><span style="font-size:34px;letter-spacing:4px">⚡${b.name.split(' ')[0]}</span><small>${b.name.split(' ').slice(1).join(' ') || 'PERFORMANCE'}</small></div>`;
  if (style === 'wide') return `<div class="bm" style="color:${b.color};letter-spacing:12px;font-size:40px">${b.name}<small style="letter-spacing:3px">AERO DYNAMICS</small></div>`;
  if (style === 'wing') return `<div class="bm" style="color:${b.color}"><span style="font-size:36px">${b.name}</span><small>◢◣ RACING PARTS</small></div>`;
  if (style === 'sun') return `<div class="bm" style="color:${b.color}"><span style="font-size:32px">☀ ${b.name}</span><small>RESEARCH & DEVELOPMENT</small></div>`;
  return `<div class="bm" style="color:${b.color}"><span style="font-size:36px;transform:skewX(-14deg);display:inline-block">${b.name}</span><small>${sub || 'SUPER TUNING'}</small></div>`;
}
