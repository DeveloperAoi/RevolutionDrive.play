// Renderer + reusable 3D "views" (showroom turntable, title scene)
import * as THREE from 'three';
import { buildEnvMap, createCar } from '../world/carModel.js';
import { Track } from '../world/track.js';
import { buildWorld } from '../world/scenery.js';
import { courseById } from '../data/courses.js';
import * as TX from '../world/textures.js';
import { EffectComposer } from '../../lib/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../../lib/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../lib/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../lib/jsm/postprocessing/OutputPass.js';

export class Gfx {
  constructor(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.env = buildEnvMap(r);
    this.view = null;
    this.quality = 1;
    // post processing: bloom on lamps / headlights / sun, then tone mapping + sRGB in the output pass
    this.composer = new EffectComposer(r);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(960, 540), 0.55, 0.45, 0.82);
    this.composer.addPass(this.renderPass); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.hq = true;
    addEventListener('resize', () => this.resize()); this.resize();
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); this.bloom.resolution.set(w / 2, h / 2); }
    this.aspect = w / h;
    if (this.view && this.view.camera) { this.view.camera.aspect = this.aspect; this.view.camera.updateProjectionMatrix(); }
  }
  setView(v) { this.view = v; if (v && v.camera) { v.camera.aspect = this.aspect; v.camera.updateProjectionMatrix(); } }
  frame(dt) {
    const v = this.view; if (!v) { this.renderer.setClearColor(0x000000); this.renderer.clear(); return; }
    if (v.update) v.update(dt);
    if (v.camera.aspect !== this.aspect) { v.camera.aspect = this.aspect; v.camera.updateProjectionMatrix(); }
    if (this.hq && v.post !== false) {
      this.renderPass.scene = v.scene; this.renderPass.camera = v.camera;
      this.bloom.strength = v.bloom ?? 0.55; this.bloom.threshold = v.bloom != null && v.bloom < 0.3 ? 0.95 : 0.82;
      this.composer.render(dt);
    } else this.renderer.render(v.scene, v.camera);
  }
  setQuality(q) { // 'high' | 'low'
    this.hq = q !== 'low';
    this.renderer.shadowMap.enabled = this.hq;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.hq ? 1.75 : 1));
    this.resize();
  }
}

// ---- showroom turntable --------------------------------------------------------
export class Showroom {
  constructor(gfx) {
    this.gfx = gfx;
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color(0x1a1c20);
    s.fog = new THREE.Fog(0x1a1c20, 18, 40);
    s.environment = gfx.env;
    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 200);
    this.bloom = 0.1;
    // floor + glowing turntable
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.35, metalness: 0.6 }));
    floor.rotation.x = -Math.PI / 2; s.add(floor);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 0.08, 64), new THREE.MeshStandardMaterial({ color: 0x1a1c21, roughness: 0.25, metalness: 0.8 }));
    table.position.y = 0.04; s.add(table);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.035, 8, 96), new THREE.MeshBasicMaterial({ color: 0xff8a00 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.085; s.add(ring);
    const halo = new THREE.Mesh(new THREE.RingGeometry(3.5, 5.2, 96), new THREE.MeshBasicMaterial({ color: 0xff7a00, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.01; s.add(halo);
    this.table = table;
    // lights
    s.add(new THREE.HemisphereLight(0x8899bb, 0x111111, 0.6));
    const key = new THREE.SpotLight(0xffffff, 400, 40, 0.5, 0.6, 1.5); key.position.set(4, 9, 6); s.add(key, key.target);
    const rim = new THREE.SpotLight(0xff9a40, 260, 40, 0.6, 0.7, 1.5); rim.position.set(-7, 5, -6); s.add(rim, rim.target);
    const fill = new THREE.DirectionalLight(0x6aa0ff, 0.7); fill.position.set(-5, 3, 6); s.add(fill);
    // backdrop panels with light strips
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 7), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff8a00 : 0x9ab0d0, transparent: true, opacity: 0.55 }));
      bar.position.set(Math.sin(a) * 16, 3.5, Math.cos(a) * 16); bar.lookAt(0, 3.5, 0); s.add(bar);
    }
    // garage interior props (original): shutter walls, shelves, tyre stacks, drums
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.8, metalness: 0.3 });
    const shutTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'); for (let y = 0; y < 256; y += 16) { g.fillStyle = '#7a7f86'; g.fillRect(0, y, 64, 12); g.fillStyle = '#4a4e54'; g.fillRect(0, y + 12, 64, 4); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 3); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    for (let k = 0; k < 4; k++) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 9), new THREE.MeshStandardMaterial({ map: shutTex, roughness: 0.7, metalness: 0.4, color: 0x8a8f96 }));
      const a = k * Math.PI / 2; wall.position.set(Math.sin(a) * -13, 4.5, Math.cos(a) * -13); wall.rotation.y = a; s.add(wall);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), wallMat); ceil.rotation.x = Math.PI / 2; ceil.position.y = 9; s.add(ceil);
    const lampM = new THREE.MeshBasicMaterial({ color: 0xfff6e0 });
    for (const x of [-5, 0, 5]) { const l = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.3), lampM); l.position.set(x, 8.9, 0); s.add(l); }
    const shelfM = new THREE.MeshStandardMaterial({ color: 0x2a5a8a, roughness: 0.6, metalness: 0.5 });
    const boxM = new THREE.MeshStandardMaterial({ color: 0xa07a4a, roughness: 0.9 });
    for (const [x, z, ry] of [[-9, -11.5, 0], [6, -11.5, 0], [-11.5, -3, Math.PI / 2]]) {
      const shelf = new THREE.Group(); shelf.position.set(x, 0, z); shelf.rotation.y = ry; s.add(shelf);
      for (let lv = 0; lv < 4; lv++) { const b = new THREE.Mesh(new THREE.BoxGeometry(4, 0.08, 1), shelfM); b.position.y = 0.5 + lv * 1.4; shelf.add(b); for (let i = 0; i < 3; i++) { const bx = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.8), boxM); bx.position.set(-1.3 + i * 1.3 + Math.sin(lv * 3 + i) * 0.2, 0.9 + lv * 1.4, 0); shelf.add(bx); } }
      for (const sx of [-2, 2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6, 0.08), shelfM); post.position.set(sx, 3, 0.45); shelf.add(post); }
    }
    const tyreM = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    for (const [x, z, n] of [[9.5, -8, 5], [10.5, -6.5, 4], [-10, 7, 6]]) for (let i = 0; i < n; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.14, 8, 18), tyreM); t.rotation.x = Math.PI / 2; t.position.set(x, 0.14 + i * 0.28, z); s.add(t); }
    const drumM = new THREE.MeshStandardMaterial({ color: 0x1a4a9a, roughness: 0.5, metalness: 0.4 });
    for (const [x, z] of [[10, 3], [10.8, 4.2], [-10.5, -8]]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 16), drumM); d.position.set(x, 0.55, z); s.add(d); }
    this.car = null; this.yaw = 0.7; this.spin = 0.25; this.drag = null; this.t = 0; this.dist = 11.5; this.offsetX = 0;
    this.bindDrag();
  }
  bindDrag() {
    const el = document.getElementById('gl');
    const down = (x) => { if (this.gfx.view !== this) return; this.drag = x; this.spin = 0; };
    const move = (x) => { if (this.drag == null) return; this.yaw += (x - this.drag) * 0.01; this.drag = x; };
    const up = () => { if (this.drag != null) { this.drag = null; setTimeout(() => this.spin = 0.25, 1500); } };
    // the stage overlay sits above the canvas; listen on window and filter by target
    addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('.rotzone')) down(e.clientX); });
    addEventListener('pointermove', (e) => move(e.clientX));
    addEventListener('pointerup', up);
  }
  setCar(spec, dress, opts = {}) {
    if (this.car) { this.scene.remove(this.car.root); this.car.dispose(); }
    this.car = createCar(spec, dress, opts);
    this.car.root.position.y = 0.08;
    this.scene.add(this.car.root);
  }
  // place the turntable in a screen window (fractions of the 16:9 stage) and choose a camera preset
  setWindow(cx = 0.5, cy = 0.5, zoom = 1) { this.win = { cx, cy, zoom }; }
  setPreset(p) { this.preset = p; if (p !== 'free') this.spin = 0; else this.spin = 0.25; }
  frameFor(x = 0) { this.setWindow(x < 0 ? 0.62 : 0.5, 0.45, 1); }
  update(dt) {
    this.t += dt;
    const P = { free: null, front: 0, rear: Math.PI, left: -Math.PI / 2, right: Math.PI / 2, top: 0.6, wheel: -Math.PI / 2 + 0.35, three: 0.7 };
    const tgt = P[this.preset || 'free'];
    if (tgt == null || this.drag != null) this.yaw += this.spin * dt;
    else { let d = tgt - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, dt * 6); }
    if (this.car) { this.car.root.rotation.y = this.yaw; this.car.showcase(this.t, this.preset === 'wheel'); }
    this.table.rotation.y = this.yaw;
    const w = this.win || { cx: 0.5, cy: 0.45, zoom: 1 };
    let cam;
    if (this.preset === 'top') cam = [0, 13, 0.6, 0.3];
    else if (this.preset === 'wheel') cam = [0, 1.0, 5.6, 0.45];
    else if (this.preset === 'front' || this.preset === 'rear') cam = [0, 1.6, 9.5, 0.55];
    else cam = [0, 2.9, this.dist, 0.35];
    const want = new THREE.Vector3(cam[0], cam[1], cam[2] / w.zoom);
    this.camera.position.lerp(want, Math.min(1, dt * 5));
    this.camera.lookAt(0, cam[3], 0);
    // shift the projection so the car sits in the requested window
    const W = 1920, H = 1080;
    this.camera.setViewOffset(W, H, (0.5 - w.cx) * W, (0.5 - w.cy) * H, W, H);
  }
}

// ---- title scene: a car parked on a night mountain road ------------------------------
export class TitleScene {
  constructor(gfx, carSpec, dress) {
    this.gfx = gfx;
    const def = courseById('akane');
    this.track = new Track(def);
    this.world = buildWorld(this.track, {});
    const s = this.scene = new THREE.Scene(); s.add(this.world.root); s.fog = this.world.fog;
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 6000);
    // park on a lit section (first lamps segment)
    const sPark = 70;
    const p = this.track.pointAt(sPark, -1.5);
    this.car = createCar(carSpec, dress, { headlights: true });
    this.car.root.position.set(p.x, p.y, p.z); this.car.root.rotation.y = p.yaw + 0.25;
    s.add(this.car.root);
    this.p = p; this.t = 0;
    // floating light motes
    const N = 400; const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = p.x + (Math.random() - .5) * 60; pos[i * 3 + 1] = p.y + Math.random() * 14; pos[i * 3 + 2] = p.z + (Math.random() - .5) * 60; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(g, new THREE.PointsMaterial({ map: TX.glowTexture('rgba(255,210,150,1)', 'rgba(255,140,40,0)'), size: 0.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffc080 }));
    s.add(this.motes);
  }
  update(dt) {
    this.t += dt;
    const p = this.p, a = this.p.yaw + 0.25 + 0.9 + Math.sin(this.t * 0.12) * 0.7;
    const r = 7.2 + Math.sin(this.t * 0.2) * 1.2;
    this.camera.position.set(p.x + Math.sin(a) * r, p.y + 1.1 + Math.sin(this.t * 0.17) * 0.4, p.z + Math.cos(a) * r);
    this.camera.lookAt(p.x, p.y + 0.7, p.z);
    const arr = this.motes.geometry.attributes.position.array;
    for (let i = 1; i < arr.length; i += 3) { arr[i] += dt * 0.4; if (arr[i] > p.y + 14) arr[i] = p.y; }
    this.motes.geometry.attributes.position.needsUpdate = true;
    this.world.update(this.camera, dt);
    this.car.showcase(this.t);
  }
}

// ---- course select background: a slow flyover of the real course ----------------------
export class CoursePreview {
  constructor(gfx) { this.gfx = gfx; this.cache = new Map(); this.camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 6000); this.scene = new THREE.Scene(); this.s = 0; }
  show(id, dir, weather, time) {
    const key = id + dir + weather + time;
    if (this.key === key) return;
    this.key = key;
    let e = this.cache.get(key);
    if (!e) {
      const track = new Track(courseById(id), dir);
      const world = buildWorld(track, { weather, time });
      const scene = new THREE.Scene(); scene.add(world.root); scene.fog = world.fog;
      e = { track, world, scene };
      this.cache.set(key, e);
      if (this.cache.size > 3) { const [k0, old] = this.cache.entries().next().value; this.cache.delete(k0); old.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    }
    this.e = e; this.scene = e.scene; this.s = 30;
  }
  update(dt) {
    if (!this.e) return;
    const t = this.e.track; this.s = (this.s + dt * 22) % Math.max(1, t.length - 60);
    const p = t.pointAt(this.s, 0), q = t.pointAt(this.s + 35, 0);
    this.camera.position.lerp(new THREE.Vector3(p.x, p.y + 5.5, p.z), this.camera.position.distanceTo(new THREE.Vector3(p.x, p.y, p.z)) > 50 ? 1 : 0.2);
    this.camera.lookAt(q.x, q.y + 1.5, q.z);
    this.camera.clearViewOffset();
    this.e.world.update(this.camera, dt);
  }
}
