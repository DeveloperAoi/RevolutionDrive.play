import { drawMeter } from './meters.js';
import { defaultMeter } from '../data/custom.js';
// Race HUD: tachometer / speedometer canvas, minimap, timing panels
export const fmt = (t) => {
  if (t == null || !isFinite(t)) return '--\'--"---';
  const m = Math.floor(t / 60), s = Math.floor(t % 60), ms = Math.floor((t * 1000) % 1000);
  return `${m}'${String(s).padStart(2, '0')}"${String(ms).padStart(3, '0')}`;
};
export const fmtDelta = (d) => (d < 0 ? '-' : '+') + Math.abs(d).toFixed(3);

export class Tacho {
  constructor(canvas, meter) { this.c = canvas; this.g = canvas.getContext('2d'); this.c.width = 460; this.c.height = 420; this.meter = meter || defaultMeter(); }
  draw(v, spec, kmh, extra = {}) {
    drawMeter(this.g, this.meter.design, this.meter, {
      rpm: v.rpm, redline: spec.engine.redline, limiter: spec.engine.limiter, gear: v.gear, kmh, boost: v.boost, turbo: spec.sound.turbo,
      auto: extra.auto, drift: (v.driftAngle || 0) * 57.3, shifting: v.shiftTimer > 0, warn: extra.warn,
    });
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
