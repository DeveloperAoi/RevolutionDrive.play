// Race HUD: tachometer / speedometer canvas, minimap, timing panels
export const fmt = (t) => {
  if (t == null || !isFinite(t)) return '--\'--"---';
  const m = Math.floor(t / 60), s = Math.floor(t % 60), ms = Math.floor((t * 1000) % 1000);
  return `${m}'${String(s).padStart(2, '0')}"${String(ms).padStart(3, '0')}`;
};
export const fmtDelta = (d) => (d < 0 ? '-' : '+') + Math.abs(d).toFixed(3);

export class Tacho {
  constructor(canvas) { this.c = canvas; this.g = canvas.getContext('2d'); this.c.width = 460; this.c.height = 420; }
  draw(v, spec, kmh, extra = {}) {
    const g = this.g, W = 460, H = 420, cx = 240, cy = 220, R = 170;
    g.clearRect(0, 0, W, H);
    const maxR = Math.ceil(spec.engine.limiter / 1000) * 1000 + 1000;
    const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
    const ang = (r) => a0 + (a1 - a0) * Math.min(1, r / maxR);
    // backplate
    g.save();
    g.beginPath(); g.arc(cx, cy, R + 18, 0, Math.PI * 2);
    const bg = g.createRadialGradient(cx, cy, 20, cx, cy, R + 18); bg.addColorStop(0, 'rgba(20,22,26,.92)'); bg.addColorStop(1, 'rgba(0,0,0,.85)');
    g.fillStyle = bg; g.fill();
    g.lineWidth = 6; g.strokeStyle = '#8e949c'; g.stroke();
    // red zone
    g.beginPath(); g.arc(cx, cy, R - 8, ang(spec.engine.redline), a1); g.lineWidth = 16; g.strokeStyle = '#d0141e'; g.stroke();
    // rpm fill arc
    const fillTo = ang(v.rpm);
    const grd = g.createLinearGradient(cx - R, 0, cx + R, 0); grd.addColorStop(0, '#ff7a00'); grd.addColorStop(1, '#ffd400');
    g.beginPath(); g.arc(cx, cy, R - 32, a0, fillTo); g.lineWidth = 14; g.strokeStyle = v.rpm > spec.engine.redline ? '#ff2a3a' : grd; g.stroke();
    // ticks
    g.fillStyle = '#fff'; g.font = 'italic 900 26px Arial Black, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let r = 0; r <= maxR; r += 500) {
      const a = ang(r), big = r % 1000 === 0;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - (big ? 26 : 16)), cy + Math.sin(a) * (R - (big ? 26 : 16)));
      g.lineTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2)); g.lineWidth = big ? 4 : 2; g.strokeStyle = r >= spec.engine.redline ? '#ff5050' : '#fff'; g.stroke();
      if (big) g.fillText(r / 1000, cx + Math.cos(a) * (R - 52), cy + Math.sin(a) * (R - 52));
    }
    // needle
    const na = ang(v.rpm);
    g.beginPath(); g.moveTo(cx - Math.cos(na) * 20, cy - Math.sin(na) * 20); g.lineTo(cx + Math.cos(na) * (R - 10), cy + Math.sin(na) * (R - 10));
    g.lineWidth = 5; g.strokeStyle = '#ff3b1a'; g.shadowColor = '#ff6a00'; g.shadowBlur = 12; g.stroke(); g.shadowBlur = 0;
    g.beginPath(); g.arc(cx, cy, 16, 0, Math.PI * 2); g.fillStyle = '#222'; g.fill(); g.strokeStyle = '#888'; g.lineWidth = 3; g.stroke();
    // gear (centre-bottom) and speed (in the open bottom of the dial)
    const gear = v.gear < 0 ? 'R' : v.gear === 0 ? 'N' : String(v.gear);
    g.textAlign = 'center';
    g.font = 'italic 900 70px Arial Black, Impact, sans-serif'; g.fillStyle = v.shiftTimer > 0 ? '#888' : '#ffd400';
    g.fillText(gear, cx, cy + 62);
    g.font = 'bold 16px sans-serif'; g.fillStyle = '#aaa'; g.fillText((extra.auto ? 'AT' : 'MT') + '  x1000rpm', cx, cy - 58);
    g.font = 'italic 900 64px Arial Black, Impact, sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'right';
    g.fillText(Math.round(kmh), cx + 40, cy + 150);
    g.font = 'italic 900 22px Arial Black, sans-serif'; g.fillStyle = '#ccc'; g.textAlign = 'left'; g.fillText('km/h', cx + 48, cy + 160);
    // boost gauge
    if (spec.sound.turbo) {
      g.beginPath(); g.arc(cx, cy, R + 8, Math.PI * 1.05, Math.PI * 1.05 + Math.PI * 0.5 * v.boost); g.lineWidth = 6; g.strokeStyle = '#36c3ff'; g.stroke();
      g.font = 'bold 16px sans-serif'; g.fillStyle = '#36c3ff'; g.textAlign = 'left'; g.fillText('BOOST', 18, 120);
    }
    // shift light
    if (v.rpm > spec.engine.redline * 0.95) { g.beginPath(); g.arc(cx, 34, 12, 0, Math.PI * 2); g.fillStyle = '#ff2a3a'; g.shadowColor = '#f00'; g.shadowBlur = 20; g.fill(); g.shadowBlur = 0; }
    g.restore();
  }
}

export class MiniMap {
  constructor(canvas, track, size = 340) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.t = track; canvas.width = size; canvas.height = size; this.size = size;
    const b = track.bounds; const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) || 1;
    this.sc = (size - 40) / span; this.ox = (b.minX + b.maxX) / 2; this.oz = (b.minZ + b.maxZ) / 2;
    // pre-render the course line
    const off = document.createElement('canvas'); off.width = off.height = size; const g = off.getContext('2d');
    this.path = (gg) => { gg.beginPath(); for (let i = 0; i < track.n; i += 2) { const [x, y] = this.map(track.x[i], track.z[i]); i ? gg.lineTo(x, y) : gg.moveTo(x, y); } if (track.closed) gg.closePath(); };
    g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, 7); g.fill();
    g.strokeStyle = 'rgba(200,206,214,.8)'; g.lineWidth = 3; g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 3, 0, 7); g.stroke();
    this.path(g); g.strokeStyle = '#000'; g.lineWidth = 11; g.lineJoin = 'round'; g.stroke();
    this.path(g); g.strokeStyle = '#e8e8e8'; g.lineWidth = 6; g.stroke();
    // sections
    for (const s of track.sections) { const p = track.pointAt(s); const [x, y] = this.map(p.x, p.z); g.fillStyle = '#ff7a00'; g.fillRect(x - 4, y - 4, 8, 8); }
    const st = track.pointAt(0); const [sx, sy] = this.map(st.x, st.z); g.fillStyle = '#3dff8a'; g.beginPath(); g.arc(sx, sy, 7, 0, 7); g.fill();
    if (!track.closed) { const gl = track.pointAt(track.length); const [gx, gy] = this.map(gl.x, gl.z); g.fillStyle = '#ffd400'; g.beginPath(); g.arc(gx, gy, 7, 0, 7); g.fill(); }
    this.base = off;
  }
  map(x, z) { return [this.size / 2 - (x - this.ox) * this.sc, this.size / 2 - (z - this.oz) * this.sc]; }
  draw(cars) {
    const g = this.g; g.clearRect(0, 0, this.size, this.size); g.drawImage(this.base, 0, 0);
    for (const c of cars) {
      const [x, y] = this.map(c.x, c.z);
      g.save(); g.translate(x, y); g.rotate(-c.yaw);
      g.beginPath(); g.moveTo(0, -11); g.lineTo(7, 8); g.lineTo(-7, 8); g.closePath();
      g.fillStyle = c.color; g.strokeStyle = '#000'; g.lineWidth = 2; g.globalAlpha = c.alpha ?? 1; g.fill(); g.stroke(); g.restore();
    }
  }
}

// static course map for selection screens
export function drawCourseMap(canvas, track, opts = {}) {
  const g = canvas.getContext('2d'); const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  const b = track.bounds; const span = Math.max((b.maxX - b.minX) / W, (b.maxZ - b.minZ) / H) || 1;
  const sc = 0.86 / span; const ox = (b.minX + b.maxX) / 2, oz = (b.minZ + b.maxZ) / 2;
  const map = (x, z) => [W / 2 - (x - ox) * sc, H / 2 - (z - oz) * sc];
  g.beginPath(); for (let i = 0; i < track.n; i += 2) { const [x, y] = map(track.x[i], track.z[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); } if (track.closed) g.closePath();
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = opts.glow || 'rgba(255,140,0,.45)'; g.lineWidth = opts.w ? opts.w * 3 : 14; g.stroke();
  g.strokeStyle = opts.color || '#fff'; g.lineWidth = opts.w || 4; g.stroke();
  const s = track.pointAt(0); const [sx, sy] = map(s.x, s.z);
  g.fillStyle = '#3dff8a'; g.beginPath(); g.arc(sx, sy, (opts.w || 4) * 1.8, 0, 7); g.fill();
  if (!track.closed) { const e = track.pointAt(track.length); const [ex, ey] = map(e.x, e.z); g.fillStyle = '#ffd400'; g.beginPath(); g.arc(ex, ey, (opts.w || 4) * 1.8, 0, 7); g.fill(); }
}
