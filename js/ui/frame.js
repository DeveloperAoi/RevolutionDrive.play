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
// arcade-cabinet style button glyphs (original drawings): round lever/D-pad plate, yellow START button, blue VIEW button
export function kgIcon(kind) {
  const tri = (r) => `<path d="M0 -15 L6 -7 L-6 -7Z" fill="#fff" transform="rotate(${r})"/>`;
  const plate = (inner) => `<svg viewBox="-24 -24 48 48" width="46" height="46"><defs><radialGradient id="kgp" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#5a5f68"/><stop offset="1" stop-color="#16181c"/></radialGradient></defs><circle r="22" fill="url(#kgp)" stroke="#c9ced6" stroke-width="2.5"/>${inner}</svg>`;
  if (kind === 'dpad') return `<i class="kg">${plate(tri(0) + tri(90) + tri(180) + tri(270) + '<circle r="4.5" fill="#9aa1ab"/>')}</i>`;
  if (kind === 'lr') return `<i class="kg">${plate(tri(90) + tri(270) + '<circle r="4.5" fill="#9aa1ab"/>')}</i>`;
  if (kind === 'ud') return `<i class="kg">${plate(tri(0) + tri(180) + '<circle r="4.5" fill="#9aa1ab"/>')}</i>`;
  const btn = (c0, c1, c2, label, tc) => `<i class="kg"><svg viewBox="-24 -24 48 48" width="46" height="46"><defs><radialGradient id="kg${label}" cx="45%" cy="30%" r="75%"><stop offset="0" stop-color="${c0}"/><stop offset=".55" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs><circle r="22.5" fill="#1a1a1a"/><circle r="19.5" fill="url(#kg${label})"/><ellipse cx="-4" cy="-10" rx="10" ry="4.5" fill="rgba(255,255,255,.55)"/><text y="5" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="${label.length > 4 ? 8.5 : 10}" fill="${tc}">${label}</text></svg></i>`;
  if (kind === 'ok') return btn('#fff7b0', '#ffd000', '#b07800', 'START', '#2a1a00');
  if (kind === 'back' || kind === 'view') return btn('#bfe6ff', '#2a8cff', '#0a3a9a', 'VIEW', '#fff');
  return '';
}
export function keyGuide(items = [['dpad', '選択'], ['ok', '決定'], ['back', '戻る']]) {
  const ic = { dpad: kgIcon('dpad'), ok: kgIcon('ok'), back: kgIcon('back'), lr: kgIcon('lr'), ud: kgIcon('ud'), view: kgIcon('view') };
  const touch = matchMedia('(pointer: coarse)').matches;
  const arrows = { dpad: [['up', '▲'], ['down', '▼'], ['left', '◀'], ['right', '▶']], lr: [['left', '◀'], ['right', '▶']], ud: [['up', '▲'], ['down', '▼']] };
  return `<div class="af-keys${touch ? ' tap' : ''}">${items.map(([k, t]) => touch && arrows[k]
    ? `<span class="kgt">${arrows[k].map(([a, g]) => `<b data-act="${a}">${g}</b>`).join('')}${t}</span>`
    : `<span data-act="${k === 'ok' ? 'ok' : k === 'back' || k === 'view' ? 'back' : ''}">${ic[k] || ''}${t}</span>`).join('')}</div>`;
}
export function titleTimer(title, timerId = 'af-timer') {
  return `<div class="af-title"><div class="t">${title}</div><div class="timer af-tm" id="${timerId}"><b>3:00</b></div></div>`;
}

// generic car silhouette icon with a highlighted zone
export function carIcon(zone = 'body', hl = '#3dbb4a') {
  // detailed side view silhouette (original): smooth body, glasshouse with pillars, rims; the selected zone glows
  const on = (k) => zone === k;
  const bodyFill = on('body') ? hl : 'url(#ciB)';
  const wheel = (cx) => `<g transform="translate(${cx} 66)"><circle r="16" fill="#111"/><circle r="11.5" fill="${on('wheel') ? hl : 'url(#ciR)'}" stroke="#222" stroke-width="1"/>${[0, 72, 144, 216, 288].map(r => `<rect x="-1.6" y="-10.5" width="3.2" height="8" fill="#2a2d33" transform="rotate(${r})"/>`).join('')}<circle r="2.6" fill="#555"/></g>`;
  return `<svg viewBox="0 0 200 90" width="170" height="77">
    <defs><linearGradient id="ciB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9dde2"/><stop offset=".45" stop-color="#a8aeb6"/><stop offset="1" stop-color="#5d636b"/></linearGradient>
    <linearGradient id="ciG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fb4c8"/><stop offset="1" stop-color="#2b3644"/></linearGradient>
    <radialGradient id="ciR" cx="40%" cy="35%"><stop offset="0" stop-color="#f4f6f8"/><stop offset="1" stop-color="#8a9097"/></radialGradient></defs>
    <ellipse cx="102" cy="80" rx="92" ry="5" fill="rgba(0,0,0,.35)"/>
    <path d="M10 63 C9 55 12 49 22 47 L60 41 C70 33 82 22 96 20 L134 19 C146 20 156 30 166 39 L186 43 C193 45 195 52 194 63 L178 64 C176 50 160 46 152 52 C147 56 146 60 146 64 L68 64 C67 50 52 45 42 51 C37 55 36 60 36 64 Z" fill="${bodyFill}" stroke="#2b2e33" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M68 40 C78 30 88 24 98 23 L132 22 C141 23 149 31 156 39 Z" fill="url(#ciG)" stroke="#1d2026" stroke-width="1.6"/>
    <path d="M112 22 L110 40" stroke="#1d2026" stroke-width="3.2"/>
    <path d="M60 48 L188 47" stroke="rgba(255,255,255,.55)" stroke-width="1.4"/>
    <path d="M84 41 L82 63 M134 40 L136 63" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
    <rect x="120" y="44" width="9" height="2.4" rx="1" fill="#2b2e33"/>
    ${zone === 'vinyl' ? '<path d="M18 54 L190 50 L191 57 L17 60Z" fill="#ffd400" opacity=".95"/>' : ''}
    <path d="M182 46 L194 48 L194 56 L184 55Z" fill="${on('front') ? hl : '#fff'}" opacity="${on('front') ? 1 : .8}"/>
    <path d="M10 50 L20 48 L20 56 L10 57Z" fill="${on('rear') ? hl : '#d32'}"/>
    <path d="M150 37 L182 43 L181 46 L148 41Z" fill="${on('hood') ? hl : 'none'}"/>
    <path d="M70 59 L144 59 L144 64 L70 64Z" fill="${on('side') ? hl : 'none'}"/>
    ${zone === 'wing' ? `<path d="M4 30 L40 29 L40 34 L4 35Z" fill="${hl}"/><path d="M16 35 L20 46 M32 34 L30 45" stroke="${hl}" stroke-width="4"/>` : ''}
    ${zone === 'muffler' ? `<rect x="2" y="61" width="16" height="6" rx="3" fill="${hl}"/>` : ''}
    ${zone === 'meter' ? `<circle cx="100" cy="45" r="28" fill="#111" stroke="${hl}" stroke-width="5"/><path d="M100 45 L117 31" stroke="#f33" stroke-width="4"/>` : ''}
    ${wheel(52)}${wheel(162)}
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
