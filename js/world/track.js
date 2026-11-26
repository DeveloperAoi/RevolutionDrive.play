// REVOLUTION DRIVE — course geometry (pure data, no rendering)
// Builds a sampled centreline from segment definitions and offers fast spatial queries
// used by physics (surface height, walls), race logic (progress, checkpoints) and AI.

export const STEP = 2; // metres between samples

export class Track {
  // dir: 'fwd' (as designed) or 'rev' (the same road driven the other way)
  constructor(def, dir = 'fwd') {
    if (dir === 'rev') def = reverseDef(def);
    this.def = def; this.dir = dir;
    this.closed = !!def.closed;
    this.build();
  }

  build() {
    const def = this.def;
    // ---- 1. curvature / grade / flags per sample
    const k = [], g = [], flags = [];
    for (const seg of def.segs) {
      const n = Math.max(1, Math.round(seg.l / STEP));
      const kk = (seg.a * Math.PI / 180) / seg.l;
      for (let i = 0; i < n; i++) {
        k.push(kk); g.push(seg.g || 0);
        flags.push({ hp: seg.hp || 0, tunnel: !!seg.tunnel, lamps: !!seg.lamps, sign: !!seg.sign && Math.abs(seg.a) > 60, signDir: Math.sign(seg.a), w: seg.w || def.width });
      }
    }
    const N = k.length;
    // smooth curvature (clothoid-like transitions) and grade
    const smooth = (arr, rad, passes) => {
      let a = arr.slice();
      for (let p = 0; p < passes; p++) {
        const b = new Array(N);
        for (let i = 0; i < N; i++) {
          let s = 0, c = 0;
          for (let j = -rad; j <= rad; j++) {
            let idx = i + j;
            if (this.closed) idx = (idx + N) % N; else idx = Math.max(0, Math.min(N - 1, idx));
            s += a[idx]; c++;
          }
          b[i] = s / c;
        }
        a = b;
      }
      return a;
    };
    let ks = smooth(k, 6, 3);
    const gs = smooth(g, 12, 3);
    // closed loop: remove residual heading so the loop closes
    if (this.closed) {
      const total = ks.reduce((s, v) => s + v * STEP, 0);
      const target = Math.round(total / (2 * Math.PI)) * 2 * Math.PI;
      const fix = (target - total) / (N * STEP);
      ks = ks.map(v => v + fix);
    }
    // ---- 2. integrate positions
    const x = new Float64Array(N + 1), z = new Float64Array(N + 1), y = new Float64Array(N + 1), h = new Float64Array(N + 1);
    let px = 0, pz = 0, py = def.startY || 0, ph = 0;
    for (let i = 0; i <= N; i++) {
      x[i] = px; z[i] = pz; y[i] = py; h[i] = ph;
      if (i === N) break;
      const hm = ph + ks[i] * STEP * 0.5;
      px += Math.sin(hm) * STEP; pz += Math.cos(hm) * STEP;
      py += gs[i] * STEP; ph += ks[i] * STEP;
    }
    if (this.closed) {
      const ex = x[N] - x[0], ez = z[N] - z[0], ey = y[N] - y[0];
      for (let i = 0; i <= N; i++) { const t = i / N; x[i] -= ex * t; z[i] -= ez * t; y[i] -= ey * t; }
    }
    // count samples: closed loops drop the duplicated last point
    const M = this.closed ? N : N + 1;
    this.n = M;
    this.x = x.slice(0, M); this.y = y.slice(0, M); this.z = z.slice(0, M);
    this.k = new Float64Array(M); this.tx = new Float64Array(M); this.tz = new Float64Array(M);
    this.nx = new Float64Array(M); this.nz = new Float64Array(M); this.bank = new Float64Array(M);
    this.w = new Float64Array(M); this.s = new Float64Array(M);
    this.flags = [];
    for (let i = 0; i < M; i++) {
      const i0 = this.idx(i - 1), i1 = this.idx(i + 1);
      let dx = this.x[i1] - this.x[i0], dz = this.z[i1] - this.z[i0];
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      this.tx[i] = dx; this.tz[i] = dz;
      this.nx[i] = dz; this.nz[i] = -dx; // left normal
      this.k[i] = ks[Math.min(i, N - 1)];
      this.bank[i] = Math.max(-0.07, Math.min(0.07, -this.k[i] * 2.2)); // outside edge raised
      this.s[i] = i * STEP;
      const f = flags[Math.min(i, N - 1)];
      this.flags.push(f); this.w[i] = f.w;
    }
    this.length = this.closed ? M * STEP : (M - 1) * STEP;
    // ---- 3. spatial hash for nearest-sample queries
    this.cell = 24;
    this.grid = new Map();
    for (let i = 0; i < M; i++) {
      const key = this.key(this.x[i], this.z[i]);
      let a = this.grid.get(key); if (!a) this.grid.set(key, a = []); a.push(i);
    }
    // bounds
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, minY = 1e9, maxY = -1e9;
    for (let i = 0; i < M; i++) {
      minX = Math.min(minX, this.x[i]); maxX = Math.max(maxX, this.x[i]);
      minZ = Math.min(minZ, this.z[i]); maxZ = Math.max(maxZ, this.z[i]);
      minY = Math.min(minY, this.y[i]); maxY = Math.max(maxY, this.y[i]);
    }
    this.bounds = { minX, maxX, minZ, maxZ, minY, maxY };
    // checkpoints / sections (4 sectors)
    this.sections = [0.25, 0.5, 0.75].map(f => f * this.length);
    // lamp positions & sign positions
    this.lamps = []; this.signs = [];
    let lastLamp = -999;
    for (let i = 0; i < M; i++) {
      const f = this.flags[i];
      if ((f.lamps || f.tunnel) && this.s[i] - lastLamp > (f.tunnel ? 16 : 42)) {
        lastLamp = this.s[i];
        this.lamps.push({ i, side: f.tunnel ? 0 : (i % 2 ? 1 : -1) * (this.def.mountainSide || 1) * -1, tunnel: f.tunnel });
      }
    }
    for (let i = 0; i < M; i += 6) {
      const f = this.flags[i];
      if (f.sign && i % 12 === 0) this.signs.push({ i, dir: f.signDir });
    }
  }

  idx(i) { return this.closed ? ((i % this.n) + this.n) % this.n : Math.max(0, Math.min(this.n - 1, i)); }
  key(x, z) { return (Math.floor(x / this.cell) * 73856093) ^ (Math.floor(z / this.cell) * 19349663); }

  // nearest sample index to (x,z). hint = previous index for locality (optional)
  nearest(x, z, hint = -1, hintY = null) {
    let best = -1, bd = Infinity;
    if (hint >= 0) {
      for (let j = -14; j <= 14; j++) {
        const i = this.idx(hint + j);
        const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (bd < 18 * 18) return best;
    }
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const arr = this.grid.get(((cx + a) * 73856093) ^ ((cz + b) * 19349663));
      if (!arr) continue;
      for (const i of arr) {
        let d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
        if (hintY !== null) d += ((this.y[i] - hintY) * 3) ** 2; // disambiguate stacked roads
        if (d < bd) { bd = d; best = i; }
      }
    }
    if (best < 0) { // far away: brute force
      for (let i = 0; i < this.n; i++) {
        const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
    }
    return best;
  }

  // project point onto the centreline around sample i -> {i, t, s, d (lateral, + = left), y (surface), nx, nz}
  project(x, z, hint = -1, hintY = null) {
    let i = this.nearest(x, z, hint, hintY);
    // choose segment [i, i+1] or [i-1, i]
    const segProj = (a) => {
      const b = this.idx(a + 1);
      const ax = this.x[a], az = this.z[a];
      const dx = this.x[b] - ax, dz = this.z[b] - az;
      const L2 = dx * dx + dz * dz || 1;
      const t = ((x - ax) * dx + (z - az) * dz) / L2;
      return { a, b, t };
    };
    let p = segProj(i);
    if (p.t < 0 && (this.closed || i > 0)) p = segProj(this.idx(i - 1));
    const t = Math.max(0, Math.min(1, p.t));
    const a = p.a, b = p.b;
    const cx = this.x[a] + (this.x[b] - this.x[a]) * t;
    const cz = this.z[a] + (this.z[b] - this.z[a]) * t;
    const nx = this.nx[a] + (this.nx[b] - this.nx[a]) * t;
    const nz = this.nz[a] + (this.nz[b] - this.nz[a]) * t;
    const d = (x - cx) * nx + (z - cz) * nz;
    const cy = this.y[a] + (this.y[b] - this.y[a]) * t;
    const bank = this.bank[a] + (this.bank[b] - this.bank[a]) * t;
    const w = this.w[a];
    let s = this.s[a] + t * STEP;
    return { i: t > 0.5 ? b : a, a, t, s, d, cx, cz, cy, nx, nz, bank, w, y: this.surfaceY(cy, d, bank, w) };
  }

  surfaceY(cy, d, bank, w) {
    const hw = w / 2;
    if (Math.abs(d) <= hw) return cy + d * bank + crown(d, hw);
    // shoulder: slight drop
    const over = Math.abs(d) - hw;
    return cy + Math.sign(d) * hw * bank - Math.min(over, 1.5) * 0.06;
  }

  pointAt(s, d = 0) {
    if (this.closed) s = ((s % this.length) + this.length) % this.length;
    else s = Math.max(0, Math.min(this.length - 0.01, s));
    const f = s / STEP; const a = Math.floor(f); const t = f - a;
    const ia = this.idx(a), ib = this.idx(a + 1);
    const lerp = (arr) => arr[ia] + (arr[ib] - arr[ia]) * t;
    const cx = lerp(this.x), cz = lerp(this.z), cy = lerp(this.y);
    const nx = lerp(this.nx), nz = lerp(this.nz), tx = lerp(this.tx), tz = lerp(this.tz);
    const bank = lerp(this.bank);
    return { x: cx + nx * d, z: cz + nz * d, y: this.surfaceY(cy, d, bank, this.w[ia]), tx, tz, nx, nz, k: lerp(this.k), yaw: Math.atan2(tx, tz), i: ia };
  }

  // distance from (x,z) to the nearest part of the road centreline (any part)
  distToRoad(x, z) {
    const i = this.nearest(x, z);
    return Math.hypot(this.x[i] - x, this.z[i] - z);
  }
}

function crown(d, hw) { const t = d / hw; return -0.04 * t * t; }

// Build the reverse-direction definition: segments in reverse order with mirrored
// turns and inverted grade, starting at the original end height.
export function reverseDef(def) {
  let endY = def.startY || 0;
  for (const s of def.segs) endY += (s.g || 0) * s.l;
  return { ...def, startY: endY, mountainSide: -(def.mountainSide || 1), segs: def.segs.slice().reverse().map(s => ({ ...s, a: -s.a, g: -(s.g || 0) })) };
}
