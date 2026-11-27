// REVOLUTION DRIVE — wheel & tyre model pack (assets/parts/wheel_pack.glb, 74 wheels converted from the
// "Wheel, Tire Pack"). Each wheel node: axle along x (face toward +x), tyre width normalised to 1 and
// tyre radius to 1, materials "tire" and "rim". Loaded in the background after start-up; until it is
// ready cars show the built-in procedural wheel, then the screen redraws.
import * as THREE from 'three';
import { share } from '../core/dispose.js';
import { GLTFLoader } from '../../lib/jsm/loaders/GLTFLoader.js';

const URL = 'assets/parts/wheel_pack.glb';
let nodes = null, loading = null; const listeners = new Set();
export function loadWheelPack() {
  if (loading) return loading;
  loading = new GLTFLoader().loadAsync(URL).then((g) => {
    nodes = new Map(); for (const n of g.scene.children) nodes.set(n.name, n);
    g.scene.traverse((m) => { if (m.geometry) share(m.geometry); }); // geometry is shared by every car that uses the wheel
    listeners.forEach(f => { try { f(); } catch (e) { console.warn(e); } });
  }).catch((e) => { console.warn('[wheels] pack failed', e); loading = null; });
  return loading;
}
export const wheelPackReady = () => !!nodes;
export const onWheelPackReady = (f) => { listeners.add(f); return () => listeners.delete(f); };

// build a pack wheel sized to tyre radius R and width W; rim colour from cfg.color. Returns null if not loaded.
export function packWheel(node, cfg, R, W, tireLook, envMap) {
  const src = nodes && nodes.get(node); if (!src) return null;
  const g = new THREE.Group();
  const o = src.clone(true);
  const tireMat = new THREE.MeshStandardMaterial({ color: tireLook === 'slick' ? 0x1c1c1e : 0x131313, roughness: tireLook === 'slick' ? 0.45 : 0.88 });
  const rimMat = new THREE.MeshStandardMaterial({ color: cfg.color || '#c9ccd0', metalness: 0.85, roughness: cfg.color === '#161616' ? 0.5 : 0.25, envMap });
  o.traverse((m) => { if (m.isMesh) { m.material = m.material.name === 'tire' ? tireMat : rimMat; m.castShadow = true; } });
  const stretch = tireLook === 'stretch' ? 0.85 : 1;
  o.scale.set(W * stretch, R, R); g.add(o);
  return g;
}
