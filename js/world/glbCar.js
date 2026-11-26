// REVOLUTION DRIVE — glTF/GLB car support
// Loads third-party car packs (.glb) and turns one car node into the same rig the procedural
// cars use: body group (paint/glass/lights detected by name), four separately spinning/steering
// wheels (split automatically when a pack merges all tyres/rims into one mesh), ride height,
// brake lights, headlights and ghost mode. Packs are registered in js/data/glbcars.js.
import * as THREE from 'three';
import { GLTFLoader } from '../../lib/jsm/loaders/GLTFLoader.js';
import { getEnvMap, paintMaterial } from './carModel.js';
import { RIDE_HEIGHTS } from '../data/cars.js';
import * as TX from './textures.js';

const packs = new Map();     // id -> { gltf, nodes: Map(name -> Object3D) }
const loading = new Map();   // id -> Promise

const clean = (n) => String(n || '').replace(/[\s.]/g, '').toLowerCase();

export function loadPack(id, url) {
  if (packs.has(id)) return Promise.resolve(packs.get(id));
  if (loading.has(id)) return loading.get(id);
  const p = new GLTFLoader().loadAsync(url).then((gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const nodes = new Map();
    gltf.scene.traverse((o) => { if (o.name) nodes.set(clean(o.name), o); });
    const e = { gltf, nodes }; packs.set(id, e); loading.delete(id); return e;
  }).catch((err) => { loading.delete(id); console.warn('[glb] pack failed', id, err); throw err; });
  loading.set(id, p); return p;
}
export const packReady = (id) => packs.has(id);
export function listNodes(id) { const e = packs.get(id); if (!e) return []; const root = findCarParent(e.gltf.scene); return root.children.map(c => c.name); }

// the node whose children are the individual cars (Sketchfab exports wrap them in several empties)
function findCarParent(scene) {
  let n = scene;
  while (n.children.length === 1 && !n.isMesh) n = n.children[0];
  return n;
}

const roleOf = (name) => {
  const s = clean(name);
  if (/tire|tyre/.test(s)) return 'tire';
  if (/wheel/.test(s) || (/rim/.test(s) && !/trim/.test(s))) return 'rim';
  if (/paint|carpaint|bodycolor/.test(s)) return 'paint';
  if (/window|glass|windshield/.test(s)) return 'glass';
  if (/front|head/.test(s)) return 'head';
  if (/rear|tail|brake/.test(s)) return 'tail';
  return 'other';
};

// collect every mesh of the car with its geometry baked into car-local space
function collect(carNode) {
  const out = [];
  carNode.traverse((o) => {
    if (!o.isMesh) return;
    // role from the mesh name or the nearest named ancestor below the car node
    let n = o, role = 'other';
    while (n && n !== carNode) { const r = roleOf(n.name); if (r !== 'other') { role = r; break; } n = n.parent; }
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld); // world space keeps the pack's up-axis fix; recentred below
    out.push({ geo: g.index ? g.toNonIndexed() : g, mat: o.material, role });
  });
  return out;
}

function centroidOf(parts) {
  const b = new THREE.Box3(); for (const p of parts) { p.geo.computeBoundingBox(); b.union(p.geo.boundingBox); }
  return b;
}

export function createGlbCar(spec, dress, opts = {}) {
  const m = spec.model; const e = packs.get(m.pack);
  if (!e) return null;
  const carNode = e.nodes.get(clean(m.node));
  if (!carNode) { console.warn('[glb] node not found', m.node); return null; }
  const envMap = getEnvMap();
  let parts = collect(carNode);

  // ---- orientation & placement: length along z, nose to +z, centred, tyres on y=0 ----
  let all = centroidOf(parts); const size = all.getSize(new THREE.Vector3()), ctr = all.getCenter(new THREE.Vector3());
  const T = new THREE.Matrix4().makeTranslation(-ctr.x, -ctr.y, -ctr.z);
  if (size.x > size.z) T.premultiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  parts.forEach(p => p.geo.applyMatrix4(T));
  const heads = parts.filter(p => p.role === 'head'), tails = parts.filter(p => p.role === 'tail');
  if (heads.length && tails.length && centroidOf(heads).getCenter(new THREE.Vector3()).z < centroidOf(tails).getCenter(new THREE.Vector3()).z) {
    const R = new THREE.Matrix4().makeRotationY(Math.PI); parts.forEach(p => p.geo.applyMatrix4(R));
  }
  if (m.rotY) { const R = new THREE.Matrix4().makeRotationY(m.rotY); parts.forEach(p => p.geo.applyMatrix4(R)); }
  if (m.scale) { const S = new THREE.Matrix4().makeScale(m.scale, m.scale, m.scale); parts.forEach(p => p.geo.applyMatrix4(S)); }
  const wheelParts = parts.filter(p => p.role === 'tire' || p.role === 'rim');
  const ground = (wheelParts.length ? centroidOf(wheelParts) : centroidOf(parts)).min.y;
  parts.forEach(p => p.geo.translate(0, -ground, 0));
  all = centroidOf(parts);
  const len = all.max.z - all.min.z, wid = all.max.x - all.min.x, hgt = all.max.y;

  // ---- split wheel meshes into four corners (front/rear x left/right) ----
  const quads = [[], [], [], []]; // 0 FL(+z,+x) 1 FR(+z,-x) 2 RL 3 RR
  for (const p of wheelParts) {
    const pos = p.geo.attributes.position; const nTri = pos.count / 3;
    const buckets = [[], [], [], []];
    for (let t = 0; t < nTri; t++) {
      let cx = 0, cz = 0; for (let k = 0; k < 3; k++) { cx += pos.getX(t * 3 + k); cz += pos.getZ(t * 3 + k); }
      buckets[(cz > 0 ? 0 : 2) + (cx > 0 ? 0 : 1)].push(t);
    }
    buckets.forEach((tris, q) => {
      if (!tris.length) return;
      const g = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(p.geo.attributes)) {
        const arr = new attr.array.constructor(tris.length * 3 * attr.itemSize);
        tris.forEach((t, i) => { for (let k = 0; k < 3 * attr.itemSize; k++) arr[i * 3 * attr.itemSize + k] = attr.array[t * 3 * attr.itemSize + k]; });
        g.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize, attr.normalized));
      }
      quads[q].push({ geo: g, mat: p.mat, role: p.role });
    });
  }

  // ---- materials ----
  const paintMat = paintMaterial(dress.color.hex, dress.color.finish);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0d12, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.9, envMap, envMapIntensity: 1.4, clearcoat: 1 });
  const lit = !!(opts.headlights || opts.flares);
  const headMat = new THREE.MeshStandardMaterial({ color: lit ? 0xffffff : 0xd8dde4, emissive: 0xfff4dd, emissiveIntensity: lit ? 2.2 : 0.15, roughness: 0.08, metalness: lit ? 0 : 0.5, envMap });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1010, emissiveIntensity: 0.9, roughness: 0.3 });
  const upgrade = (mt) => { const c = mt.clone(); c.envMap = envMap; if ('envMapIntensity' in c) c.envMapIntensity = 0.8; return c; };
  const matFor = (p) => p.role === 'paint' ? paintMat : p.role === 'glass' ? glass : p.role === 'head' ? headMat : p.role === 'tail' ? tailMat : upgrade(p.mat);

  // ---- assemble rig ----
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  for (const p of parts) {
    if (p.role === 'tire' || p.role === 'rim') continue;
    p.geo.computeVertexNormals();
    const mesh = new THREE.Mesh(p.geo, matFor(p)); body.add(mesh);
  }
  const wheels = []; let R = 0.32, fz = 1.3, rz = -1.3;
  quads.forEach((list, q) => {
    if (!list.length) return;
    const b = centroidOf(list); const c = b.getCenter(new THREE.Vector3());
    const holder = new THREE.Group(); holder.position.copy(c); root.add(holder);
    const steer = new THREE.Group(); holder.add(steer);
    const spin = new THREE.Group(); steer.add(spin);
    for (const p of list) { p.geo.translate(-c.x, -c.y, -c.z); p.geo.computeVertexNormals(); spin.add(new THREE.Mesh(p.geo, upgrade(p.mat))); }
    R = (b.max.y - b.min.y) / 2;
    const front = q < 2; if (front) fz = c.z; else rz = c.z;
    wheels.push({ holder, steer, spin, front, side: q % 2 ? -1 : 1, baseY: c.y });
  });

  // ---- shadow, lights, flares ----
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(wid * 1.25, len * 1.15), new THREE.MeshBasicMaterial({ map: TX.glowTexture('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; shadow.renderOrder = 1; root.add(shadow);
  const hb = heads.length ? centroidOf(parts.filter(p => p.role === 'head')) : null;
  const frontZ = all.max.z, rearZ = all.min.z, yH = hb ? hb.getCenter(new THREE.Vector3()).y : hgt * 0.45;
  const lightW = hb ? Math.max(0.3, hb.max.x * 0.75) : wid / 2 - 0.3;
  const lights = [];
  if (opts.headlights) for (const sd of [-1, 1]) {
    const sl = new THREE.SpotLight(0xfff2dd, 320, 110, 0.5, 0.5, 1.25);
    sl.position.set(sd * lightW, yH, frontZ); sl.target.position.set(sd * 1.0, -0.6, frontZ + 20);
    body.add(sl, sl.target); lights.push(sl);
  }
  const flareMat = new THREE.SpriteMaterial({ map: TX.glowTexture('rgba(255,255,250,1)', 'rgba(180,200,255,0)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  for (const sd of [-1, 1]) { const f = new THREE.Sprite(flareMat); f.position.set(sd * lightW, yH, frontZ + 0.05); f.scale.set(0.6, 0.6, 1); f.visible = lit; body.add(f); }
  const tb = tails.length ? centroidOf(parts.filter(p => p.role === 'tail')) : null;
  const tY = tb ? tb.getCenter(new THREE.Vector3()).y : hgt * 0.5, tW = tb ? Math.max(0.3, tb.max.x * 0.8) : wid / 2 - 0.3;
  const tailFlareMat = new THREE.SpriteMaterial({ map: TX.glowTexture('rgba(255,60,40,1)', 'rgba(255,0,0,0)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: lit ? 0.6 : 0.15 });
  const tailFlares = [];
  for (const sd of [-1, 1]) { const f = new THREE.Sprite(tailFlareMat); f.position.set(sd * tW, tY, rearZ - 0.05); f.scale.set(0.7, 0.5, 1); body.add(f); tailFlares.push(f); }

  const drop = (RIDE_HEIGHTS.find(h => h.id === (dress.height || 0)) || RIDE_HEIGHTS[0]).drop;
  body.position.y = -drop;

  return {
    root, body, wheels, lights, paintMat, dims: { len, wid, hgt, R, fz, rz }, glb: true,
    setBrake(v) { tailMat.emissiveIntensity = 0.9 + v * 3.5; tailFlareMat.opacity = 0.45 + v * 0.55; tailFlares.forEach(f => f.scale.set(0.7 + v * 0.8, 0.5 + v * 0.4, 1)); },
    setGhost() {
      root.traverse(o => { if (o.material && !o.isSprite) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.35; o.material.depthWrite = false; } });
      shadow.visible = false;
    },
    pose(v, surf) {
      root.position.set(v.x, surf.y, v.z);
      root.rotation.order = 'YXZ';
      root.rotation.set(-surf.pitch, v.yaw, surf.roll);
      body.rotation.x = v.pitch; body.rotation.z = v.roll;
      body.position.y = -drop - Math.abs(v.pitch) * 0.3;
      for (const w of wheels) { w.spin.rotation.x = w.front ? (v.wheelRotF ?? v.wheelRot) : (v.wheelRotR ?? v.wheelRot); if (w.front) w.steer.rotation.y = v.steer; }
    },
    showcase(t, spinWheels = false) { body.position.y = -drop; body.rotation.set(0, 0, 0); for (const w of wheels) { w.spin.rotation.x = spinWheels ? t * 6 : 0; w.steer.rotation.y = w.front ? Math.sin(t * 0.5) * 0.25 : 0; } },
    dispose() { root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); },
  };
}
