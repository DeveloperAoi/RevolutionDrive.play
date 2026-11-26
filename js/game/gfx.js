// Renderer + reusable 3D "views" (showroom turntable, title scene)
import * as THREE from 'three';
import { buildEnvMap, createCar } from '../world/carModel.js';
import { Track } from '../world/track.js';
import { buildWorld } from '../world/scenery.js';
import { courseById } from '../data/courses.js';
import * as TX from '../world/textures.js';

export class Gfx {
  constructor(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.env = buildEnvMap(r);
    this.view = null;
    this.quality = 1;
    addEventListener('resize', () => this.resize()); this.resize();
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    if (this.view && this.view.camera) { this.view.camera.aspect = this.aspect; this.view.camera.updateProjectionMatrix(); }
  }
  setView(v) { this.view = v; if (v && v.camera) { v.camera.aspect = this.aspect; v.camera.updateProjectionMatrix(); } }
  frame(dt) {
    const v = this.view; if (!v) { this.renderer.setClearColor(0x000000); this.renderer.clear(); return; }
    if (v.update) v.update(dt);
    if (v.camera.aspect !== this.aspect) { v.camera.aspect = this.aspect; v.camera.updateProjectionMatrix(); }
    this.renderer.render(v.scene, v.camera);
  }
}

// ---- showroom turntable --------------------------------------------------------
export class Showroom {
  constructor(gfx) {
    this.gfx = gfx;
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color(0x07080b);
    s.fog = new THREE.Fog(0x07080b, 14, 40);
    s.environment = gfx.env;
    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 200);
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
  setCar(spec, dress) {
    if (this.car) { this.scene.remove(this.car.root); this.car.dispose(); }
    this.car = createCar(spec, dress, {});
    this.car.root.position.y = 0.08;
    this.scene.add(this.car.root);
    this.flash = 1;
  }
  frameFor(x = 0) { this.offsetX = x; }
  update(dt) {
    this.t += dt;
    this.yaw += this.spin * dt;
    if (this.car) { this.car.root.rotation.y = this.yaw; this.car.showcase(this.t); }
    this.table.rotation.y = this.yaw;
    const cx = this.offsetX;
    this.camera.position.set(cx, 2.9, this.dist);
    this.camera.lookAt(cx, 0.35, 0);
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
