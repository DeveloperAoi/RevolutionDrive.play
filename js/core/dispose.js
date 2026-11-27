// GPU memory hygiene: free geometries, materials and textures when a car / scene is thrown away.
// Resources registered with share() are reused across many objects (cached canvas textures, model-pack
// templates, the environment map) and are never freed here.
export const SHARED = new WeakSet();
export const share = (x) => { if (x) SHARED.add(x); return x; };
export const unshare = (x) => { if (x) SHARED.delete(x); return x; };

const TEX_KEYS = ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'normalMap', 'alphaMap', 'aoMap', 'bumpMap', 'lightMap',
  'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'displacementMap', 'specularMap', 'envMap'];
const freeTex = (t, seen) => { if (t && t.isTexture && !SHARED.has(t) && !seen.has(t)) { seen.add(t); t.dispose(); } };

export function disposeMaterial(m, seen = new Set()) {
  if (!m || SHARED.has(m) || seen.has(m)) return; seen.add(m);
  for (const k of TEX_KEYS) freeTex(m[k], seen);
  if (m.uniforms) for (const u of Object.values(m.uniforms)) freeTex(u && u.value, seen);
  m.dispose();
}

export function disposeObject(root) {
  if (!root) return; const seen = new Set();
  root.traverse((o) => {
    const g = o.geometry; if (g && !SHARED.has(g) && !seen.has(g)) { seen.add(g); g.dispose(); }
    if (o.material) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) disposeMaterial(m, seen);
    if (o.isLight && o.shadow && o.shadow.map) o.shadow.dispose(); // shadow maps are 2048² depth textures
    if (o.isScene) { freeTex(o.background, seen); freeTex(o.environment, seen); }
  });
}
