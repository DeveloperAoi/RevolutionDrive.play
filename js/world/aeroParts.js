// REVOLUTION DRIVE — dress-up aero parts from the parts model pack (assets/parts/aero_parts.glb)
// The pack holds 23 rear wings (wing_01..wing_23), a front canard set and a front splitter, already
// converted to car space (x = width, y up, +z = nose, metres). Each part's origin is where it mounts:
//   wings: bottom of the mounts at the rear edge · canard: front edge centre · splitter: top front edge.
// mountAero() scales a part to the car's width and bolts it on; it works for procedural and GLB cars.
import * as THREE from 'three';
import { share } from '../core/dispose.js';
import { GLTFLoader } from '../../lib/jsm/loaders/GLTFLoader.js';

const URL = 'assets/parts/aero_parts.glb';
let parts = null, loading = null, carbonTex = null;
const listeners = new Set();

export function loadAeroParts() {
  if (loading) return loading;
  carbonTex = share(new THREE.TextureLoader().load('assets/parts/carbon.png', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }));
  carbonTex.wrapS = carbonTex.wrapT = THREE.RepeatWrapping; carbonTex.colorSpace = THREE.SRGBColorSpace;
  loading = new GLTFLoader().loadAsync(URL).then((g) => {
    parts = new Map();
    g.scene.traverse((m) => { if (m.geometry) share(m.geometry); }); // shared by every car with the part
    for (const n of g.scene.children) {
      const box = new THREE.Box3().setFromObject(n);
      parts.set(n.name, { obj: n, size: box.getSize(new THREE.Vector3()) });
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
  const o = e.obj.clone(true); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.setScalar(1);
  o.traverse((m) => { if (m.isMesh) { m.material = mats[m.material.name] || mats.carbon; m.castShadow = true; m.receiveShadow = false; } });
  return { obj: o, size: e.size };
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
