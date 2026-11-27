// REVOLUTION DRIVE — race effects: tyre smoke + skid marks
import * as THREE from 'three';

function smokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let k = 0; k < 14; k++) {
    const x = 64 + (Math.random() - .5) * 40, y = 64 + (Math.random() - .5) * 40, r = 22 + Math.random() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class RaceFX {
  constructor(scene, opts = {}) {
    this.scene = scene;
    // ---- smoke: a pool of sprites drawn as one Points cloud with per-particle size/alpha ----
    const N = this.N = opts.low ? 260 : 600;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3); this.vel = new Float32Array(N * 3); this.age = new Float32Array(N).fill(99); this.life = new Float32Array(N).fill(1);
    this.size = new Float32Array(N); this.alpha = new Float32Array(N);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: smokeTexture() }, tint: { value: new THREE.Color(opts.night ? 0x8a8e96 : 0xe8eaee) }, scale: { value: 520 } },
      vertexShader: 'attribute float size; attribute float alpha; varying float vA; uniform float scale; void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; uniform vec3 tint; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(tint, t.a * vA); if (gl_FragColor.a < 0.01) discard; }',
      transparent: true, depthWrite: false, fog: false,
    });
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; this.points.renderOrder = 5; scene.add(this.points);
    this.next = 0;
    // ---- skid marks: ring buffer of quads ----
    const S = this.S = opts.low ? 900 : 2400;
    const sg = new THREE.BufferGeometry();
    this.sp = new Float32Array(S * 4 * 3); this.sa = new Float32Array(S * 4);
    const idx = new Uint32Array(S * 6); for (let i = 0; i < S; i++) { const a = i * 4; idx.set([a, a + 1, a + 2, a + 2, a + 1, a + 3], i * 6); }
    sg.setAttribute('position', new THREE.BufferAttribute(this.sp, 3)); sg.setAttribute('alpha', new THREE.BufferAttribute(this.sa, 1)); sg.setIndex(new THREE.BufferAttribute(idx, 1));
    const smat = new THREE.ShaderMaterial({
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.02,0.02,0.025, vA); }',
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    this.skids = new THREE.Mesh(sg, smat); this.skids.frustumCulled = false; this.skids.renderOrder = 2; scene.add(this.skids);
    this.si = 0; this.lastMark = new Map();
    this.tmp = new THREE.Vector3();
  }
  emit(x, y, z, vx, vz, amt) {
    const i = this.next; this.next = (this.next + 1) % this.N;
    this.pos[i * 3] = x + (Math.random() - .5) * 0.4; this.pos[i * 3 + 1] = y + 0.25; this.pos[i * 3 + 2] = z + (Math.random() - .5) * 0.4;
    this.vel[i * 3] = vx * 0.25 + (Math.random() - .5) * 1.5; this.vel[i * 3 + 1] = 0.6 + Math.random() * 0.9; this.vel[i * 3 + 2] = vz * 0.25 + (Math.random() - .5) * 1.5;
    this.age[i] = 0; this.life[i] = 1.0 + Math.random() * 1.0 * amt; this.size[i] = 0.8;
  }
  mark(key, x, y, z, nx, nz, w, a) {
    const L = this.lastMark.get(key);
    this.lastMark.set(key, { x, y, z, nx, nz, w, a, t: performance.now() });
    if (!L || Math.hypot(L.x - x, L.z - z) > 3) return;
    if (Math.hypot(L.x - x, L.z - z) < 0.25) { this.lastMark.set(key, L); return; }
    const i = this.si; this.si = (this.si + 1) % this.S; const o = i * 12;
    const p = [L.x - L.nx * L.w, L.y, L.z - L.nz * L.w, L.x + L.nx * L.w, L.y, L.z + L.nz * L.w, x - nx * w, y, z - nz * w, x + nx * w, y, z + nz * w];
    this.sp.set(p, o); this.sa.set([L.a, L.a, a, a], i * 4);
    this.skids.geometry.attributes.position.needsUpdate = true; this.skids.geometry.attributes.alpha.needsUpdate = true;
  }
  update(dt, cars, focus) {
    for (const car of cars) {
      const v = car.veh, m = car.model; if (!m || !m.dims) continue;
      const slide = Math.max(v.slipRear || 0, v.wheelspin || 0, v.lockup || 0, Math.min(1, Math.abs(v.driftAngle || 0) * 2.2 - 0.25));
      const spd = v.speed || 0;
      const dist = focus ? Math.hypot(v.x - focus.veh.x, v.z - focus.veh.z) : 0;
      const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
      for (const sd of [-1, 1]) {
        const lx = sd * (m.dims.wid / 2 - 0.25), lz = m.dims.rz;
        const wx = v.x + cy * lx + sy * lz, wz = v.z - sy * lx + cy * lz, wy = car.surfY + 0.03;
        const key = cars.indexOf(car) * 2 + sd;
        if (slide > 0.25 && spd > 3) {
          this.mark(key, wx, wy, wz, cy, -sy, 0.11, Math.min(0.55, 0.15 + slide * 0.45));
          if (dist < 120 && slide > 0.4 && Math.random() < (slide - 0.3) * 0.9 * dt * 60) this.emit(wx, wy, wz, v.vx, v.vz, slide);
        } else this.lastMark.delete(key);
      }
    }
    for (let i = 0; i < this.N; i++) {
      if (this.age[i] > this.life[i]) { if (this.alpha[i]) { this.alpha[i] = 0; } continue; }
      this.age[i] += dt; const t = this.age[i] / this.life[i];
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3] *= 1 - dt * 1.2; this.vel[i * 3 + 2] *= 1 - dt * 1.2; this.vel[i * 3 + 1] *= 1 - dt * 0.5;
      this.size[i] = 0.7 + t * 3.6; this.alpha[i] = Math.max(0, (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88) * 0.3);
    }
    const ga = this.points.geometry.attributes; ga.position.needsUpdate = true; ga.size.needsUpdate = true; ga.alpha.needsUpdate = true;
  }
  dispose() { this.scene.remove(this.points, this.skids); this.points.geometry.dispose(); this.skids.geometry.dispose(); }
}
