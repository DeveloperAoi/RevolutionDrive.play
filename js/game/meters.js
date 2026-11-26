// REVOLUTION DRIVE — tachometer / speedometer designs (all original)
// drawMeter(ctx, design, cfg, s): canvas 460x420, s = live state
//   s: { rpm, redline, limiter, gear, kmh, boost, turbo, auto, drift, shifting, warn }
import * as TX from '../world/textures.js';

const F = (w, px) => `${w} ${px}px "Arial Black", Impact, sans-serif`;
let carbonPat = null;
function faceFill(g, cfg, x, y, r) {
  if (cfg.bg === 'white') return '#eef0f2';
  if (cfg.bg === 'smoke') return 'rgba(20,22,26,.55)';
  if (cfg.bg === 'carbon') {
    if (!carbonPat) { const c = document.createElement('canvas'); c.width = c.height = 16; const cg = c.getContext('2d'); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { cg.fillStyle = (i + j) % 2 ? '#1a1a1d' : '#2c2c31'; cg.fillRect(i * 8, j * 8, 8, 8); } carbonPat = g.createPattern(c, 'repeat'); }
    return carbonPat;
  }
  const grd = g.createRadialGradient(x, y, 10, x, y, r); grd.addColorStop(0, 'rgba(26,28,33,.95)'); grd.addColorStop(1, 'rgba(0,0,0,.9)'); return grd;
}
const txt = (cfg) => cfg.bg === 'white' ? (cfg.text === '#ffffff' ? '#111' : cfg.text) : cfg.text;
const gearStr = (s) => s.gear < 0 ? 'R' : s.gear === 0 ? 'N' : String(s.gear);

function dial(g, s, cfg, { cx, cy, R, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, maxR, numbers = true, tickColor, redColor = '#d0141e', fillArc = true, needle = '#ff3b1a', needleW = 5, step = 1000 }) {
  const ang = (r) => a0 + (a1 - a0) * Math.min(1, Math.max(0, r) / maxR);
  g.beginPath(); g.arc(cx, cy, R - 8, ang(s.redline), a1); g.lineWidth = 14; g.strokeStyle = redColor; g.stroke();
  if (fillArc) { g.beginPath(); g.arc(cx, cy, R - 30, a0, ang(s.rpm)); g.lineWidth = 12; g.strokeStyle = s.rpm > s.redline ? '#ff2a3a' : cfg.light; g.shadowColor = cfg.light; g.shadowBlur = 14; g.stroke(); g.shadowBlur = 0; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = F('italic 900', R * 0.15); g.fillStyle = tickColor || txt(cfg);
  for (let r = 0; r <= maxR; r += step / 2) {
    const a = ang(r), big = r % step === 0;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - (big ? 24 : 14)), cy + Math.sin(a) * (R - (big ? 24 : 14))); g.lineTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2));
    g.lineWidth = big ? 4 : 2; g.strokeStyle = r >= s.redline ? '#ff5050' : (tickColor || txt(cfg)); g.stroke();
    if (big && numbers) g.fillText(r / 1000, cx + Math.cos(a) * (R - 48), cy + Math.sin(a) * (R - 48));
  }
  const na = ang(s.rpm);
  g.beginPath(); g.moveTo(cx - Math.cos(na) * 18, cy - Math.sin(na) * 18); g.lineTo(cx + Math.cos(na) * (R - 10), cy + Math.sin(na) * (R - 10));
  g.lineWidth = needleW; g.strokeStyle = needle; g.shadowColor = needle; g.shadowBlur = 10; g.stroke(); g.shadowBlur = 0;
  g.beginPath(); g.arc(cx, cy, 14, 0, 7); g.fillStyle = '#222'; g.fill(); g.strokeStyle = '#999'; g.lineWidth = 3; g.stroke();
}
function shiftLights(g, s, x, y, n = 7, gap = 26, r = 8) {
  const on = Math.round(Math.max(0, (s.rpm - s.redline * 0.7) / (s.redline * 0.3)) * n);
  const flash = s.rpm > s.redline * 0.98 && (Date.now() / 80 | 0) % 2;
  for (let i = 0; i < n; i++) {
    const c = i < n * 0.45 ? '#2aff6a' : i < n * 0.8 ? '#ffd400' : '#ff2a3a';
    g.beginPath(); g.arc(x + (i - (n - 1) / 2) * gap, y, r, 0, 7);
    g.fillStyle = (i < on && !flash) || (flash) ? c : 'rgba(80,80,80,.6)'; g.shadowColor = c; g.shadowBlur = i < on ? 12 : 0; g.fill(); g.shadowBlur = 0;
  }
}
function driftTag(g, s, x, y, cfg) {
  const d = Math.abs(s.drift || 0);
  g.font = F('italic 900', 16); g.fillStyle = d > 12 ? cfg.light : '#777'; g.textAlign = 'center'; g.fillText('DRIFT', x, y);
  g.font = F('italic 900', 24); g.fillStyle = d > 12 ? '#fff' : '#666'; g.fillText(d > 3 ? Math.round(d) + '°' : '--', x, y + 24);
}

export function drawMeter(g, design, cfg, s) {
  const W = 460, H = 420; g.clearRect(0, 0, W, H);
  const maxR = Math.ceil(s.limiter / 1000) * 1000 + 1000;
  g.save();
  switch (design) {
    case 'infinity': {
      // small speed/gear pod overlapping a large tacho (original layout)
      const cx = 290, cy = 220, R = 160;
      g.beginPath(); g.arc(cx, cy, R + 12, 0, 7); g.fillStyle = faceFill(g, cfg, cx, cy, R); g.fill(); g.lineWidth = 8; g.strokeStyle = '#b8bec6'; g.stroke();
      dial(g, s, cfg, { cx, cy, R, maxR, a0: Math.PI * 0.6, a1: Math.PI * 2.1, needle: '#ffffff', needleW: 4 });
      const px = 112, py = 250, pr = 92;
      g.beginPath(); g.arc(px, py, pr + 8, 0, 7); g.fillStyle = faceFill(g, cfg, px, py, pr); g.fill(); g.lineWidth = 7; g.strokeStyle = '#b8bec6'; g.stroke();
      g.textAlign = 'center'; g.fillStyle = cfg.light; g.font = F('italic 900', 56); g.fillText(gearStr(s), px + 16, py + 16);
      g.font = F('bold', 14); g.fillStyle = txt(cfg); g.fillText(s.auto ? 'AT' : 'MT', px - 34, py + 18);
      driftTag(g, s, px - 18, py - 52, cfg);
      g.textAlign = 'right'; g.font = F('italic 900', 58); g.fillStyle = txt(cfg); g.fillText(Math.round(s.kmh), cx + 70, cy + 120);
      g.font = F('italic 900', 18); g.textAlign = 'left'; g.fillText('km/h', cx + 76, cy + 128);
      break;
    }
    case 'formula': {
      // F-style: arched LED bar, big centre gear, shift lights
      g.fillStyle = faceFill(g, cfg, 230, 220, 240); roundRect(g, 20, 70, 420, 300, 30); g.fill(); g.lineWidth = 4; g.strokeStyle = '#555'; g.stroke();
      shiftLights(g, s, 230, 98, 11, 34, 10);
      const segs = 30, frac = Math.min(1, s.rpm / maxR);
      for (let i = 0; i < segs; i++) {
        const a = Math.PI * 1.1 + Math.PI * 0.8 * (i / (segs - 1));
        const x = 230 + Math.cos(a) * 170, y = 330 + Math.sin(a) * 170;
        g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
        const red = i / segs > s.redline / maxR;
        g.fillStyle = i / segs < frac ? (red ? '#ff2a3a' : cfg.light) : 'rgba(90,90,90,.5)'; g.fillRect(-6, -14, 12, 28); g.restore();
      }
      g.textAlign = 'center'; g.font = F('italic 900', 120); g.fillStyle = s.shifting ? '#888' : '#fff'; g.fillText(gearStr(s), 230, 260);
      g.font = F('italic 900', 40); g.fillStyle = txt(cfg); g.fillText(Math.round(s.kmh), 230, 335); g.font = F('bold', 14); g.fillText('KM/H', 230, 358);
      g.font = F('bold', 16); g.fillStyle = cfg.light; g.textAlign = 'left'; g.fillText(Math.round(s.rpm) + ' RPM', 44, 350);
      driftTag(g, s, 390, 320, cfg);
      break;
    }
    case 'future': {
      const cx = 240, cy = 220, R = 170;
      g.beginPath(); g.arc(cx, cy, R + 10, 0, 7); g.fillStyle = faceFill(g, cfg, cx, cy, R); g.fill();
      const a0 = Math.PI * 0.7, a1 = Math.PI * 2.3, segs = 48;
      for (let i = 0; i < segs; i++) {
        const t = i / segs, a = a0 + (a1 - a0) * t;
        const lit = t < s.rpm / maxR, red = t > s.redline / maxR;
        g.beginPath(); g.arc(cx, cy, R - 6, a, a + (a1 - a0) / segs * 0.7); g.lineWidth = 18;
        g.strokeStyle = lit ? (red ? '#ff2a3a' : cfg.light) : 'rgba(255,255,255,.08)'; g.shadowColor = cfg.light; g.shadowBlur = lit ? 16 : 0; g.stroke();
      }
      g.shadowBlur = 0;
      g.beginPath(); g.arc(cx, cy, R - 34, 0, 7); g.lineWidth = 2; g.strokeStyle = cfg.light; g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
      // hexagon gear box
      g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; g.lineTo(cx + Math.cos(a) * 58, cy - 20 + Math.sin(a) * 58); } g.closePath();
      g.lineWidth = 3; g.strokeStyle = cfg.light; g.shadowColor = cfg.light; g.shadowBlur = 12; g.stroke(); g.shadowBlur = 0;
      g.textAlign = 'center'; g.font = F('italic 900', 70); g.fillStyle = '#fff'; g.fillText(gearStr(s), cx, cy - 18);
      g.font = F('italic 900', 50); g.fillStyle = txt(cfg); g.fillText(Math.round(s.kmh), cx, cy + 92); g.font = F('bold', 14); g.fillText('KM/H  ·  ' + (s.auto ? 'AT' : 'MT'), cx, cy + 122);
      driftTag(g, s, cx, cy - 120, cfg);
      break;
    }
    case 'digital': {
      g.fillStyle = faceFill(g, cfg, 230, 230, 240); roundRect(g, 14, 110, 432, 260, 18); g.fill(); g.lineWidth = 5; g.strokeStyle = '#888'; g.stroke();
      const bars = 40, frac = s.rpm / maxR;
      for (let i = 0; i < bars; i++) {
        const h = 20 + i * 1.6; const x = 34 + i * 10; const red = i / bars > s.redline / maxR;
        g.fillStyle = i / bars < frac ? (red ? '#ff2a3a' : cfg.light) : 'rgba(90,90,90,.45)'; g.fillRect(x, 200 - h, 7, h);
      }
      g.font = F('bold', 14); g.fillStyle = txt(cfg); g.textAlign = 'left'; g.fillText('RPM x1000', 34, 222);
      for (let r = 0; r <= maxR; r += 2000) g.fillText(r / 1000, 34 + r / maxR * 400, 242);
      g.textAlign = 'right'; g.font = F('italic 900', 92); g.fillStyle = txt(cfg); g.fillText(String(Math.round(s.kmh)).padStart(3, ' '), 330, 330);
      g.font = F('bold', 18); g.textAlign = 'left'; g.fillText('km/h', 338, 330);
      g.textAlign = 'center'; g.fillStyle = cfg.light; g.font = F('italic 900', 64); g.fillText(gearStr(s), 400, 290);
      driftTag(g, s, 70, 300, cfg);
      break;
    }
    case 'classic': {
      const cx = 240, cy = 220, R = 170;
      g.beginPath(); g.arc(cx, cy, R + 16, 0, 7); const bz = g.createLinearGradient(0, cy - R, 0, cy + R); bz.addColorStop(0, '#f4f6f8'); bz.addColorStop(0.5, '#7d838b'); bz.addColorStop(1, '#d7dbe0'); g.fillStyle = bz; g.fill();
      g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fillStyle = cfg.bg === 'dark' ? '#f4f1e8' : faceFill(g, cfg, cx, cy, R); g.fill();
      const c2 = { ...cfg, text: cfg.bg === 'dark' ? '#111111' : cfg.text, bg: cfg.bg === 'dark' ? 'white' : cfg.bg };
      dial(g, s, c2, { cx, cy, R, maxR, fillArc: false, needle: '#c01010', needleW: 3, tickColor: txt(c2) });
      g.textAlign = 'center'; g.font = 'italic 700 16px Georgia, serif'; g.fillStyle = txt(c2); g.fillText('REVOLUTION', cx, cy - 60);
      g.fillStyle = '#111'; roundRect(g, cx - 54, cy + 50, 108, 40, 6); g.fill();
      g.font = F('bold', 26); g.fillStyle = '#ffd400'; g.fillText(String(Math.round(s.kmh)).padStart(3, '0'), cx, cy + 72);
      g.font = F('italic 900', 40); g.fillStyle = txt(c2); g.fillText(gearStr(s), cx, cy + 128);
      break;
    }
    case 'sport': {
      const cx = 240, cy = 220, R = 170;
      g.beginPath(); g.arc(cx, cy, R + 12, 0, 7); g.fillStyle = '#111'; g.fill();
      g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fillStyle = cfg.bg === 'dark' ? '#f2c40c' : faceFill(g, cfg, cx, cy, R); g.fill();
      const c2 = { ...cfg, text: cfg.bg === 'dark' ? '#111111' : cfg.text, bg: cfg.bg === 'dark' ? 'white' : cfg.bg };
      dial(g, s, c2, { cx, cy, R, maxR, fillArc: false, needle: '#d01010', needleW: 5, tickColor: '#111' });
      g.textAlign = 'center'; g.font = F('italic 900', 66); g.fillStyle = '#111'; g.fillText(gearStr(s), cx, cy + 66);
      g.font = F('italic 900', 34); g.fillText(Math.round(s.kmh) + ' km/h', cx, cy + 128);
      break;
    }
    case 'racing': {
      const cx = 240, cy = 230, R = 165;
      g.beginPath(); g.arc(cx, cy, R + 12, 0, 7); g.fillStyle = faceFill(g, { ...cfg, bg: cfg.bg === 'dark' ? 'carbon' : cfg.bg }, cx, cy, R); g.fill(); g.lineWidth = 6; g.strokeStyle = '#d0141e'; g.stroke();
      shiftLights(g, s, cx, 30, 9, 30, 9);
      dial(g, s, cfg, { cx, cy, R, maxR, a0: Math.PI * 0.85, a1: Math.PI * 2.15, needle: '#ff2010', needleW: 6, step: 2000 });
      g.textAlign = 'center'; g.font = F('italic 900', 64); g.fillStyle = cfg.light; g.fillText(gearStr(s), cx, cy + 60);
      g.fillStyle = '#000'; roundRect(g, cx - 80, cy + 100, 160, 52, 8); g.fill();
      g.font = F('italic 900', 42); g.fillStyle = txt(cfg); g.fillText(Math.round(s.kmh), cx, cy + 128);
      driftTag(g, s, cx + 110, cy + 90, cfg);
      break;
    }
    default: {
      const cx = 240, cy = 220, R = 170;
      g.beginPath(); g.arc(cx, cy, R + 18, 0, 7); g.fillStyle = faceFill(g, cfg, cx, cy, R); g.fill(); g.lineWidth = 6; g.strokeStyle = '#8e949c'; g.stroke();
      dial(g, s, cfg, { cx, cy, R, maxR, a0: Math.PI * 0.8, a1: Math.PI * 2.2 });
      g.textAlign = 'center'; g.font = F('italic 900', 70); g.fillStyle = s.shifting ? '#888' : '#ffd400'; g.fillText(gearStr(s), cx, cy + 62);
      g.font = F('bold', 16); g.fillStyle = '#aaa'; g.fillText((s.auto ? 'AT' : 'MT') + '  x1000rpm', cx, cy - 58);
      g.font = F('italic 900', 64); g.fillStyle = txt(cfg); g.textAlign = 'right'; g.fillText(Math.round(s.kmh), cx + 40, cy + 150);
      g.font = F('italic 900', 22); g.textAlign = 'left'; g.fillText('km/h', cx + 48, cy + 160);
    }
  }
  if (s.turbo && design !== 'formula' && design !== 'digital') {
    g.beginPath(); g.arc(design === 'infinity' ? 290 : 240, design === 'racing' ? 230 : 220, 186, Math.PI * 1.08, Math.PI * 1.08 + Math.PI * 0.4 * s.boost); g.lineWidth = 5; g.strokeStyle = '#36c3ff'; g.stroke();
  }
  if (s.warn) { g.font = F('italic 900', 22); g.fillStyle = (Date.now() / 250 | 0) % 2 ? '#ff2a3a' : '#ffd400'; g.textAlign = 'left'; g.fillText('⚠ ' + s.warn, 10, 404); }
  g.restore();
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// simulated revving state for previews
export function demoState(t, spec) {
  const red = spec?.engine.redline || 7500, lim = spec?.engine.limiter || 7800;
  const cyc = (t % 4) / 4; const rpm = 1000 + (cyc < 0.75 ? cyc / 0.75 : (1 - cyc) / 0.25) * (red - 500);
  return { rpm, redline: red, limiter: lim, gear: 1 + Math.floor((t / 4) % 5), kmh: 40 + rpm / red * 120, boost: Math.min(1, rpm / red), turbo: !!spec?.sound.turbo, auto: true, drift: Math.sin(t) * 30, shifting: false };
}
