// REVOLUTION DRIVE — dress-up aero parts from the parts model pack (assets/parts/aero_parts.glb)
// The pack holds 23 rear wings (wing_01..wing_23), a front canard set and a front splitter, already
// converted to car space (x = width, y up, +z = nose, metres). Each part's origin is where it mounts:
//   wings: bottom of the mounts at the rear edge · canard: front edge centre · splitter: top front edge.
// mountAero() scales a part to the car's width and bolts it on; it works for procedural and GLB cars.
import * as THREE from 'three';
import { share } from '../core/dispose.js';
import { GLTFLoader } from '../../lib/jsm/loaders/GLTFLoader.js';

const URL = 'assets/parts/aero_parts.glb';
const KIT_URL = 'assets/parts/body_parts.glb'; // body-kit pack: front/rear bumpers, bonnets, side skirts
let parts = null, loading = null, carbonTex = null;
const listeners = new Set();

export function loadAeroParts() {
  if (loading) return loading;
  carbonTex = share(new THREE.TextureLoader().load('assets/parts/carbon.png', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }));
  carbonTex.wrapS = carbonTex.wrapT = THREE.RepeatWrapping; carbonTex.colorSpace = THREE.SRGBColorSpace;
  const ld = new GLTFLoader();
  loading = Promise.all([ld.loadAsync(URL), ld.loadAsync(KIT_URL).catch((e) => { console.warn('[aero] body kit failed', e); return null; })]).then(([g, kit]) => {
    parts = new Map();
    for (const sc of [g, kit]) if (sc) {
      sc.scene.traverse((m) => { if (m.geometry) share(m.geometry); }); // shared by every car with the part
      for (const n of sc.scene.children) {
        const box = new THREE.Box3().setFromObject(n);
        parts.set(n.name, { obj: n, size: box.getSize(new THREE.Vector3()), box });
      }
    }
    listeners.forEach(f => { try { f(); } catch (e) { console.warn(e); } });
    return parts;
  }).catch((e) => { console.warn('[aero] parts pack failed', e); loading = null; });
  return loading;
}
export const aeroReady = () => !!parts;
export const onAeroReady = (f) => { listeners.add(f); return () => listeners.delete(f); };

function clonePart(name, mats) {
  const e = parts && parts.get(name); if (!e) return null;
  // wrap the node: it keeps its own scale (the body-kit pack stores int16 positions with a node scale)
  const inner = e.obj.clone(true); inner.position.set(0, 0, 0); inner.rotation.set(0, 0, 0);
  inner.traverse((m) => { if (m.isMesh) { m.material = mats[m.material.name] || mats.carbon; m.castShadow = true; m.receiveShadow = false; } });
  const o = new THREE.Group(); o.add(inner);
  return { obj: o, size: e.size, box: e.box };
}

// A: dress.aero · c: { wid, frontZ, rearZ, deckY, noseY, lipY, paintMat, envMap }
export function mountAero(body, A, c) {
  if (!parts || !A) return;
  const carbon = new THREE.MeshStandardMaterial({ map: carbonTex, roughness: 0.28, metalness: 0.35, envMap: c.envMap, envMapIntensity: 0.9 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.45, metalness: 0.5, envMap: c.envMap });
  // width is fitted to the car; height/depth follow the same scale but never exceed maxH (no roof-high wings)
  const put = (name, mats, fitW, x, y, z, lim = [0.55, 1.3], maxH = 9) => {
    const p = clonePart(name, mats); if (!p) return null;
    const s = Math.max(lim[0], Math.min(lim[1], fitW / p.size.x)), sy = Math.min(s, maxH / p.size.y);
    p.obj.scale.set(s, sy, Math.min(s, Math.max(sy, s * 0.8))); p.obj.position.set(x, y, z); body.add(p.obj); return p;
  };
  // ---- body kit (model pack): front / rear bumper, bonnet, side skirts ----
  const ds = (mt) => { const c = mt.clone(); c.side = THREE.DoubleSide; return c; };
  const kitMats = { paint: ds(c.paintMat), carbon: ds(carbon), black: ds(new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.55, metalness: 0.15, envMap: c.envMap })),
    chrome: ds(new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.12, metalness: 1, envMap: c.envMap })), glass: ds(new THREE.MeshStandardMaterial({ color: 0x16202a, roughness: 0.05, metalness: 0.6, envMap: c.envMap })),
    gray: ds(new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 0.5, metalness: 0.3, envMap: c.envMap })) };
  const fb = A.fbumper > 0 ? put('fbumper_' + A.fbumper, kitMats, c.wid * 1.03, 0, c.groundY ?? 0.08, c.frontZ + 0.05, [0.7, 1.25], c.bumpH ?? 9) : null;
  if (fb && c.bumpH) { // procedural hulls: sit on the ground line, front face just ahead of the nose
    fb.obj.position.y = c.groundY - fb.box.min.y * fb.obj.scale.y; fb.obj.position.z = c.frontZ + 0.03 - fb.box.max.z * fb.obj.scale.z; }
  const rb = A.rbumper > 0 ? put('rbumper_' + A.rbumper, kitMats, c.wid * 1.01, 0, (c.groundY ?? 0.08) + 0.04, c.rearZ - 0.05, [0.7, 1.3], c.bumpH ? c.bumpH * 1.15 : 9) : null;
  if (rb && c.bumpH) { rb.obj.position.y = c.groundY + 0.02 - rb.box.min.y * rb.obj.scale.y; rb.obj.position.z = c.rearZ - 0.03 - rb.box.min.z * rb.obj.scale.z; }
  if (A.bonnet > 0 && c.hood) {
    const p = put('bonnet_' + A.bonnet, kitMats, c.wid * 0.86, 0, c.hood.y + 0.008, c.hood.z0 + 0.03, [0.6, 1.2]);
    if (p) { const room = (c.frontZ - c.hood.z0) * 0.98; p.obj.scale.z = Math.min(p.obj.scale.z, room / p.size.z); p.obj.scale.y = p.obj.scale.x * 0.6; p.obj.rotation.x = c.hood.slope || 0; if (c.bumpH) p.obj.position.y = c.hood.y - 0.01 - p.box.min.y * p.obj.scale.y; } // bonnet: flattened bulges so vented hoods sit low on any car
  }
  if (A.side > 0 && c.side) for (const sd of [-1, 1]) {
    const p = put('skirt_' + A.side, kitMats, 0.12, 0, (c.groundY ?? 0.08) + 0.02, c.side.z, [0.9, 1.4]); if (!p) continue;
    p.obj.scale.z = c.side.len / p.size.z; p.obj.scale.x *= sd; p.obj.position.x = sd * (c.side.x - 0.04);
  }

  // rear wing
  if (A.wing > 0) {
    const name = 'wing_' + String(A.wing).padStart(2, '0');
    put(name, { carbon, black, paint: c.paintMat }, c.wid * 0.97, 0, c.deckY - 0.01, c.rearZ + 0.08, [0.55, 1.3], 0.46);
  }
  // front splitter (1 carbon / 2 body colour)
  if (A.fspoiler > 0) {
    const m = A.fspoiler === 2 ? c.paintMat : carbon;
    put('splitter', { carbon: m, black, paint: m }, c.wid * 1.0, 0, c.lipY, c.frontZ + 0.07, [0.7, 1.2]);
  }
  // canards (1 carbon / 2 body colour)
  if (A.canard > 0) {
    const m = A.canard === 2 ? c.paintMat : carbon;
    put('canard', { carbon: m, black, paint: m }, c.wid * 1.02, 0, c.noseY, c.frontZ + 0.03, [0.7, 1.2]);
  }
}
