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

// ---- START MENU / SHOP background: an original roadside car shop on a sunny afternoon ----------
function signCanvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
export class LotScene {
  constructor(gfx) {
    this.gfx = gfx; this.bloom = 0.25;
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color(0x9cc4ec); s.fog = new THREE.Fog(0xb8d2ea, 60, 220);
    s.environment = gfx.env;
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 600);
    s.add(new THREE.HemisphereLight(0xdfeeff, 0x4a4030, 1.1));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.6); sun.position.set(-30, 45, 25); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    s.add(sun, sun.target);
    // ground: concrete lot + asphalt road
    const concrete = signCanvas(256, 256, (g) => { g.fillStyle = '#9a9a96'; g.fillRect(0, 0, 256, 256); for (let k = 0; k < 2500; k++) { const v = 120 + Math.random() * 60; g.fillStyle = `rgba(${v},${v},${v - 4},.35)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } g.strokeStyle = 'rgba(40,40,40,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256); });
    concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping; concrete.repeat.set(20, 20);
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.95 }));
    lot.rotation.x = -Math.PI / 2; lot.receiveShadow = true; s.add(lot);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(400, 12), new THREE.MeshStandardMaterial({ map: TX.roadTexture(false), roughness: 0.9 }));
    road.material.map = road.material.map.clone(); road.material.map.rotation = Math.PI / 2; road.material.map.repeat.set(1, 25); road.material.map.needsUpdate = true;
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, 16); road.receiveShadow = true; s.add(road);
    // parking lines
    for (let k = -3; k <= 3; k++) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 5.4), new THREE.MeshBasicMaterial({ color: 0xf2f2f0 })); ln.rotation.x = -Math.PI / 2; ln.position.set(-14 + k * 3.1, 0.02, 4); s.add(ln); }
    // ---- the shop building (original design) ----
    const shop = new THREE.Group(); shop.position.set(2, 0, -6); s.add(shop);
    const siding = signCanvas(256, 256, (g) => { g.fillStyle = '#e9e9e6'; g.fillRect(0, 0, 256, 256); for (let x = 0; x < 256; x += 16) { g.fillStyle = '#c9cac7'; g.fillRect(x, 0, 2, 256); g.fillStyle = '#f7f7f5'; g.fillRect(x + 2, 0, 3, 256); } });
    siding.wrapS = siding.wrapT = THREE.RepeatWrapping; siding.repeat.set(4, 1.4);
    const wallM = new THREE.MeshStandardMaterial({ map: siding, roughness: 0.6, metalness: 0.2 });
    const blackM = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.5, metalness: 0.3 });
    const glassM = new THREE.MeshStandardMaterial({ color: 0x2a3a4c, roughness: 0.05, metalness: 0.85, envMapIntensity: 1.6, emissive: 0x3a4a5a, emissiveIntensity: 0.35 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(14, 4.6, 9), wallM); body.position.y = 2.3; shop.add(body);
    // black fascia with the sign
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(15.2, 1.7, 10.2), blackM); fascia.position.y = 5.3; shop.add(fascia);
    const signT = signCanvas(1024, 116, (g, w, h) => { g.fillStyle = '#141518'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'italic 900 40px "Arial Black", Arial'; g.textBaseline = 'middle'; g.fillText('CAR  SHOP', 40, h / 2 + 4); g.font = 'italic 900 84px "Arial Black", Arial'; g.textAlign = 'right'; g.fillText('REV GARAGE', w - 40, h / 2 + 6); g.fillStyle = '#ff7a00'; g.fillRect(310, h / 2 - 3, 160, 6); });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(15, 1.7), new THREE.MeshStandardMaterial({ map: signT, emissive: 0xffffff, emissiveMap: signT, emissiveIntensity: 0.25, roughness: 0.5 }));
    sign.position.set(0, 5.3, 5.11); shop.add(sign);
    const sideSign = sign.clone(); sideSign.scale.set(0.66, 1, 1); sideSign.rotation.y = -Math.PI / 2; sideSign.position.set(-7.61, 5.3, 0); shop.add(sideSign);
    // shop front: glass doors / windows + roller shutter bay
    const win = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.4), glassM); win.position.set(-3.4, 1.9, 4.51); shop.add(win);
    for (let k = 0; k <= 4; k++) { const mul = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.5, 0.12), blackM); mul.position.set(-6.6 + k * 1.6, 1.9, 4.55); shop.add(mul); }
    const shutT = signCanvas(64, 256, (g) => { for (let y = 0; y < 256; y += 16) { g.fillStyle = '#b8bcc2'; g.fillRect(0, y, 64, 12); g.fillStyle = '#7a7e85'; g.fillRect(0, y + 12, 64, 4); } });
    shutT.wrapS = shutT.wrapT = THREE.RepeatWrapping; shutT.repeat.set(6, 2.2);
    const shutter = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.8), new THREE.MeshStandardMaterial({ map: shutT, roughness: 0.5, metalness: 0.6 })); shutter.position.set(3.6, 1.9, 4.52); shop.add(shutter);
    const sideWin = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.4), glassM); sideWin.rotation.y = -Math.PI / 2; sideWin.position.set(-7.01, 2.1, 0); shop.add(sideWin);
    // annex workshop
    const annex = new THREE.Mesh(new THREE.BoxGeometry(9, 6.5, 10), new THREE.MeshStandardMaterial({ color: 0x8e9196, roughness: 0.7, metalness: 0.4 })); annex.position.set(13, 3.25, -8); s.add(annex);
    // feather flag ("REV UP" — original)
    const flagT = signCanvas(128, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#1a7ad0'); gr.addColorStop(1, '#2aa8ff'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.save(); g.translate(w / 2 + 14, 40); g.rotate(Math.PI / 2); g.font = 'italic 900 64px "Arial Black", Arial'; g.fillText('REV UP!', 0, 0); g.restore(); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.moveTo(0, 420); g.quadraticCurveTo(w / 2, 380, w, 430); g.lineTo(w, 470); g.quadraticCurveTo(w / 2, 420, 0, 460); g.fill(); });
    const flag = new THREE.Group(); flag.position.set(9.5, 0, 2.5); s.add(flag);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 4.6, 6), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 })); pole.position.y = 2.3; flag.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 3.8, 1, 8), new THREE.MeshStandardMaterial({ map: flagT, side: THREE.DoubleSide, roughness: 0.8 })); cloth.position.set(0.52, 2.55, 0); flag.add(cloth);
    this.cloth = cloth;
    // props: tyre stacks, cones, vending machine
    const tyreM = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    for (const [x, z, n] of [[8.5, -0.5, 4], [9.4, -1.2, 3], [-8.6, -2, 5]]) for (let i = 0; i < n; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.14, 8, 18), tyreM); t.rotation.x = Math.PI / 2; t.position.set(x, 0.14 + i * 0.28, z); t.castShadow = true; s.add(t); }
    const coneM = new THREE.MeshStandardMaterial({ color: 0xff5a00, roughness: 0.6 });
    for (const [x, z] of [[5.2, 3.8], [6.4, 3.6], [-9.5, 6]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 12), coneM); c.position.set(x, 0.35, z); c.castShadow = true; s.add(c); }
    const vm = new THREE.Mesh(new THREE.BoxGeometry(1, 1.85, 0.75), new THREE.MeshStandardMaterial({ color: 0xd0202a, roughness: 0.4 })); vm.position.set(-6.2, 0.93, -1); s.add(vm);
    // trees around the lot
    const cg = new THREE.ConeGeometry(2.4, 6.5, 8); cg.translate(0, 6.2, 0); const cg2 = new THREE.SphereGeometry(2.6, 8, 6); cg2.translate(0, 4.2, 0);
    const trunkG = new THREE.CylinderGeometry(0.2, 0.3, 3.4, 6); trunkG.translate(0, 1.7, 0);
    const leafA = new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 0.9, flatShading: true }), leafB = new THREE.MeshStandardMaterial({ color: 0x4a7a32, roughness: 0.9, flatShading: true });
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
    const rnd = (() => { let a = 7; return () => ((a = (a * 9301 + 49297) % 233280) / 233280); })();
    for (let k = 0; k < 70; k++) {
      const a = rnd() * Math.PI * 2, r = 26 + rnd() * 40; const x = Math.cos(a) * r, z = Math.sin(a) * r - 10; if (z > 8 && z < 24) continue;
      const tr = new THREE.Group(); tr.position.set(x, 0, z); const sc = 0.8 + rnd() * 0.9; tr.scale.setScalar(sc);
      tr.add(new THREE.Mesh(trunkG, trunkM)); const crown = new THREE.Mesh(rnd() < 0.5 ? cg : cg2, rnd() < 0.5 ? leafA : leafB); crown.castShadow = true; tr.add(crown); s.add(tr);
    }
    s.traverse(o => { if (o.isMesh) { o.receiveShadow = true; if (o !== lot && o !== road) o.castShadow = true; } });
    this.cars = []; this.preset = 'cars'; this.t = 0; this.win = { cx: 0.62, cy: 0.42 };
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3();
  }
  setCars(list) { // [{spec, dress}] up to 3 — parked in the bays
    for (const c of this.cars) { this.scene.remove(c.root); c.dispose(); }
    this.cars = list.slice(0, 3).map((c, k) => {
      const m = createCar(c.spec, c.dress, {}); m.showcase(0);
      m.root.position.set(-16 + k * 3.1 + 1.55, 0, 4.2); m.root.rotation.y = Math.PI + 0.12 - k * 0.05;
      m.root.traverse(o => { if (o.isMesh && !(o.material.isMeshBasicMaterial && o.material.transparent)) o.castShadow = true; });
      this.scene.add(m.root); return m;
    });
  }
  setPreset(p) { this.preset = p; this.snap = true; }
  update(dt) {
    this.t += dt;
    const P = this.preset === 'shop'
      ? { pos: [-13, 2.4, 21], look: [3.5, 3.4, -4] }
      : { pos: [-5.5 + Math.sin(this.t * 0.15) * 0.8, 2.1, 17], look: [-13.5, 1.2, 2] };
    const tp = new THREE.Vector3(...P.pos), tl = new THREE.Vector3(...P.look);
    if (this.snap) { this.camPos.copy(tp); this.camLook.copy(tl); this.snap = false; }
    this.camPos.lerp(tp, Math.min(1, dt * 2.5)); this.camLook.lerp(tl, Math.min(1, dt * 2.5));
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    // flag waving
    const pa = this.cloth.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) { const y = pa.getY(i), x0 = i % 2 ? 0.5 : -0.5; pa.setZ(i, Math.sin(this.t * 3 + y * 1.6) * 0.08 * (x0 + 0.5)); }
    pa.needsUpdate = true;
    const W = 1920, H = 1080, w = this.win;
    this.camera.setViewOffset(W, H, (0.5 - w.cx) * W, (0.5 - w.cy) * H, W, H);
  }
}
