// REVOLUTION DRIVE — builds the 3D world for a Track
import * as THREE from 'three';
import { STEP } from './track.js';
import * as TX from './textures.js';
import { TIMES } from '../data/courses.js';

const LAMP_COLOR = new THREE.Color(1.0, 0.72, 0.38);   // sodium
const TUNNEL_COLOR = new THREE.Color(1.0, 0.62, 0.25);

// Patch a standard material so a per-vertex "lamp" colour is added as emissive light,
// letting us bake hundreds of street-lamp pools without real-time lights.
function lampify(mat, strength = 1) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 lamp;\nvarying vec3 vLamp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLamp = lamp;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLamp;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vLamp * ${strength.toFixed(2)};`);
  };
  return mat;
}

export function buildWorld(track, opts = {}) {
  const def = track.def;
  const time = TIMES[opts.time || def.time] || TIMES.night;
  const weather = opts.weather || def.weather;
  const wet = weather === 'rain';
  const root = new THREE.Group();
  const lampsOn = time.lamps;
  const HW = !!def.highway;

  // ---- lamp light field (CPU) -------------------------------------------
  const lampPts = track.lamps.map(L => {
    const i = L.i, hw = track.w[i] / 2;
    if (L.tunnel) return { x: track.x[i], y: track.y[i] + 5.5, z: track.z[i], tunnel: true, side: 0, i };
    const d = L.side * (hw + (HW ? 0.4 : 1.2));
    return { x: track.x[i] + track.nx[i] * d, y: track.y[i] + (HW ? 10 : 8), z: track.z[i] + track.nz[i] * d, side: L.side, i };
  });
  const lampGrid = new Map(); const LC = 40;
  for (const p of lampPts) { const k = Math.floor(p.x / LC) + ',' + Math.floor(p.z / LC); (lampGrid.get(k) || lampGrid.set(k, []).get(k)).push(p); }
  const lightAt = (x, y, z, out) => {
    out.setRGB(0, 0, 0);
    if (!lampsOn && !lampPts.some(p => p.tunnel)) return out;
    const cx = Math.floor(x / LC), cz = Math.floor(z / LC);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const arr = lampGrid.get((cx + a) + ',' + (cz + b)); if (!arr) continue;
      for (const p of arr) {
        if (!p.tunnel && !lampsOn) continue;
        const dx = x - p.x, dz = z - p.z, dy = y - p.y;
        if (Math.abs(dy) > 14) continue;
        const r = p.tunnel ? 13 : 19;
        const d2 = (dx * dx + dz * dz) / (r * r);
        if (d2 >= 1) continue;
        const f = (1 - d2) ** 2 * (p.tunnel ? 1.1 : 1.35);
        out.r += (p.tunnel ? TUNNEL_COLOR.r : LAMP_COLOR.r) * f;
        out.g += (p.tunnel ? TUNNEL_COLOR.g : LAMP_COLOR.g) * f;
        out.b += (p.tunnel ? TUNNEL_COLOR.b : LAMP_COLOR.b) * f;
      }
    }
    return out;
  };
  const tmpC = new THREE.Color();

  // ---- generic ribbon builder -------------------------------------------
  // profile(i) -> array of {d, h, u} lateral points; builds strip along all samples
  const ribbon = (profileFn, vScale, mat, filter = null, close = track.closed) => {
    const n = track.n; const rows = [];
    let cols = 0;
    for (let i = 0; i < n; i++) { const p = profileFn(i); rows.push(p); cols = Math.max(cols, p ? p.length : 0); }
    const pos = [], uv = [], lamp = [], idx = [];
    const vmap = new Array(n);
    let vc = 0;
    for (let i = 0; i < n; i++) {
      const p = rows[i]; if (!p) continue;
      vmap[i] = vc;
      const cx = track.x[i], cy = track.y[i], cz = track.z[i], nx = track.nx[i], nz = track.nz[i];
      for (const q of p) {
        const x = cx + nx * q.d, z = cz + nz * q.d;
        const y = q.abs !== undefined ? q.abs : cy + q.h;
        pos.push(x, y, z); uv.push(q.u, track.s[i] / vScale);
        lightAt(x, y + 0.5, z, tmpC); lamp.push(tmpC.r, tmpC.g, tmpC.b);
        vc++;
      }
    }
    const last = close ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % n;
      if (vmap[i] === undefined || vmap[j] === undefined) continue;
      if (filter && !filter(i)) continue;
      const a0 = vmap[i], b0 = vmap[j], c = rows[i].length;
      for (let k = 0; k < c - 1; k++) {
        idx.push(a0 + k, b0 + k, a0 + k + 1, a0 + k + 1, b0 + k, b0 + k + 1);
      }
    }
    // fix wrap-around v for closed loops: duplicate seam is acceptable (texture repeat)
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('lamp', new THREE.Float32BufferAttribute(lamp, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    root.add(mesh); return mesh;
  };

  // ---- road --------------------------------------------------------------
  const roadTex = HW ? TX.highwayRoadTexture(wet) : TX.roadTexture(wet);
  const roadMat = lampify(new THREE.MeshStandardMaterial({
    map: roadTex, roughness: wet ? 0.28 : HW ? 0.62 : 0.86, metalness: wet ? 0.15 : HW ? 0.08 : 0.0, roughnessMap: TX.roughTexture(),
    color: wet ? 0x8a8c90 : 0xffffff,
  }), 1.0);
  const crown = (d, hw) => -0.04 * (d / hw) ** 2;
  const road = ribbon(i => {
    const hw = track.w[i] / 2, b = track.bank[i];
    return [-1, -0.6, -0.25, 0, 0.25, 0.6, 1].map(t => ({ d: t * hw, h: t * hw * b + crown(t * hw, hw) + 0.02, u: (1 - (t + 1) / 2) }));
  }, 16, roadMat);
  road.name = 'road'; road.receiveShadow = true;

  // shoulders (gravel strip) & kerb drop
  const shMat = lampify(new THREE.MeshStandardMaterial({ map: TX.gravelTexture(), roughness: 1, color: wet ? 0x777777 : 0xbbbbbb }), 1);
  for (const side of [-1, 1]) {
    ribbon(i => {
      const hw = track.w[i] / 2, b = track.bank[i];
      const e = side * hw, yEdge = e * b + crown(hw, hw) + 0.02;
      const pts = [{ d: e, h: yEdge, u: 0 }, { d: e + side * 1.6, h: yEdge - 0.09, u: 0.5 }];
      return side < 0 ? pts.reverse() : pts;
    }, 4, shMat);
  }

  // ---- terrain, walls, tunnels ------------------------------------------
  const mSide = def.mountainSide || 1;
  const sideOf = (i) => {
    // which side is mountain (up) at sample i: base + slow alternation to keep things varied
    const wobble = Math.sin(track.s[i] / 420 + 1.3) > 0.55 ? -1 : 1;
    return mSide * wobble;
  };
  const terrainMat = lampify(new THREE.MeshStandardMaterial({ map: TX.terrainTexture(def.terrain), roughness: 1, color: 0xffffff }), 0.7);
  const rockMat = lampify(new THREE.MeshStandardMaterial({ map: TX.rockTexture(), roughness: 0.95, color: 0xbfbab0 }), 0.8);
  const terrainCols = (i, side) => {
    const up = sideOf(i) === side;
    const hw = track.w[i] / 2 + 1.6;
    const dists = up ? [0, 0.4, 3, 9, 20, 42, 75] : [0, 1.5, 5, 12, 26, 50, 90];
    const hts = up ? [-0.1, 0.6, 5.5, 11, 20, 34, 52] : [-0.1, -0.8, -5, -13, -26, -46, -70];
    const out = [];
    let stop = false, prev = null;
    for (let c = 0; c < dists.length; c++) {
      const d = side * (hw + dists[c]);
      const x = track.x[i] + track.nx[i] * d, z = track.z[i] + track.nz[i] * d;
      let h = hts[c] + (c > 1 ? noise2(x * 0.02, z * 0.02) * 6 * c / 3 : 0);
      if (!stop && c > 0) {
        // keep away from other parts of the road (switchbacks)
        const j = track.nearest(x, z, -1, track.y[i] + h);
        const ds = Math.abs(track.s[j] - track.s[i]);
        const sep = Math.hypot(track.x[j] - x, track.z[j] - z);
        const far = track.closed ? Math.min(ds, track.length - ds) : ds;
        if (far > 40 && sep < track.w[j] / 2 + 5) stop = true;
      }
      if (stop && prev) { out.push({ ...prev }); continue; }
      prev = { d, h, u: c / 2 };
      out.push(prev);
    }
    return side < 0 ? out.reverse() : out;
  };
  const isTunnel = (i) => track.flags[i].tunnel;
  if (!HW) for (const side of [-1, 1]) {
    // near wall/rock face only on the mountain side (first 3 columns) uses rock material
    ribbon(i => isTunnel(i) ? null : terrainCols(i, side), 30, terrainMat);
  }
  // concrete retaining walls on the mountain side
  if (!HW) ribbon(i => {
    if (isTunnel(i)) return null;
    const side = sideOf(i); const hw = track.w[i] / 2 + 1.6;
    const b = track.bank[i];
    const e = side * hw; const y0 = e * b - 0.1;
    const pts = [{ d: e + side * 0.2, h: y0, u: 0 }, { d: e + side * 0.6, h: y0 + 4.5, u: 1 }];
    return side > 0 ? pts : pts.reverse();
  }, 8, rockMat);

  // tunnels
  const tunMat = lampify(new THREE.MeshStandardMaterial({ map: TX.tunnelTexture(), roughness: 0.9, side: THREE.DoubleSide }), 1.0);
  ribbon(i => {
    if (!isTunnel(i)) return null;
    const hw = track.w[i] / 2 + 1.4; const pts = [];
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI * k / 10;
      const d = Math.cos(a) * hw, h = Math.sin(a) * 6.2 + (k === 0 || k === 10 ? -0.1 : 0) + Math.min(1, Math.sin(a) * 3) * 1.0;
      pts.push({ d, h: k === 0 || k === 10 ? -0.1 : h, u: k / 10 });
    }
    return pts;
  }, 6, tunMat, (i) => isTunnel(track.idx(i + 1)));
  // tunnel portals (mountain face around entrances)
  const portalMat = new THREE.MeshStandardMaterial({ color: 0x5c5a55, roughness: 0.9, map: TX.rockTexture() });
  for (let i = 1; i < track.n; i++) {
    const a = isTunnel(i - 1), b = isTunnel(i);
    if (a === b) continue;
    const at = b ? i : i - 1;
    const hw = track.w[at] / 2 + 1.4;
    const shape = new THREE.Shape();
    shape.moveTo(-40, -2); shape.lineTo(40, -2); shape.lineTo(40, 30); shape.lineTo(-40, 30); shape.closePath();
    const hole = new THREE.Path(); hole.moveTo(hw, -2.2);
    for (let k = 0; k <= 16; k++) { const ang = Math.PI * k / 16; hole.lineTo(Math.cos(ang) * hw, Math.sin(ang) * 6.2 + Math.min(1, Math.sin(ang) * 3)); }
    hole.lineTo(-hw, -2.2); shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false });
    const m = new THREE.Mesh(g, portalMat);
    m.position.set(track.x[at], track.y[at], track.z[at]);
    m.rotation.y = Math.atan2(track.tx[at], track.tz[at]);
    if (!b) m.rotateY(Math.PI);
    m.translateZ(-1);
    root.add(m);
    // mouth light band
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), new THREE.MeshBasicMaterial({ map: TX.signTexture(def.jp.slice(0, 2) + 'トンネル', '', '#1d5b2a') }));
    sign.position.set(0, 9, -0.05); sign.rotation.y = Math.PI; m.add(sign);
  }

  // ---- guardrails ----------------------------------------------------------
  const railMat = lampify(new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 0.75, roughness: 0.38, side: THREE.DoubleSide }), 0.6);
  const postGeo = new THREE.BoxGeometry(0.12, 0.85, 0.12);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.6, roughness: 0.5 });
  const posts = [];
  for (const side of HW ? [] : [-1, 1]) {
    ribbon(i => {
      if (isTunnel(i)) return null;
      const hw = track.w[i] / 2 + 1.5, b = track.bank[i];
      const e = side * hw, y0 = side * (track.w[i] / 2) * b - 0.08;
      // W-beam: three-step profile
      return [
        { d: e, h: y0 + 0.48, u: 0 }, { d: e + side * 0.06, h: y0 + 0.58, u: 0.33 },
        { d: e, h: y0 + 0.68, u: 0.66 }, { d: e + side * 0.06, h: y0 + 0.78, u: 1 },
      ];
    }, 4, railMat, null);
    for (let i = 0; i < track.n; i += 2) {
      if (isTunnel(i)) continue;
      const hw = track.w[i] / 2 + 1.58, b = track.bank[i];
      const d = side * hw;
      posts.push(new THREE.Vector3(track.x[i] + track.nx[i] * d, track.y[i] + side * (track.w[i] / 2) * b + 0.34, track.z[i] + track.nz[i] * d));
    }
  }
  const postMesh = new THREE.InstancedMesh(postGeo, postMat, posts.length);
  const m4 = new THREE.Matrix4();
  posts.forEach((p, k) => { m4.makeTranslation(p.x, p.y, p.z); postMesh.setMatrixAt(k, m4); });
  root.add(postMesh);
  // delineator reflectors on rails (catch the headlights)
  const reflGeo = new THREE.PlaneGeometry(0.12, 0.12);
  const reflMat = new THREE.MeshBasicMaterial({ color: 0xffaa22 });
  const refls = posts.filter((_, k) => k % 6 === 0);
  const reflMesh = new THREE.InstancedMesh(reflGeo, reflMat, refls.length);
  refls.forEach((p, k) => { m4.makeTranslation(p.x, p.y + 0.42, p.z); reflMesh.setMatrixAt(k, m4); });
  root.add(reflMesh);

  // ---- street lamps -----------------------------------------------------
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 8, 6);
  const armGeo = new THREE.BoxGeometry(0.08, 0.08, 2.2);
  const headGeo = new THREE.BoxGeometry(0.5, 0.16, 0.9);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x777b80, metalness: 0.6, roughness: 0.5 });
  const headMat = new THREE.MeshBasicMaterial({ color: lampsOn ? 0xffd9a0 : 0x888888 });
  const glowMat = new THREE.SpriteMaterial({ map: TX.glowTexture(), color: 0xffb060, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: lampsOn ? 0.9 : 0 });
  const tunGlowMat = new THREE.SpriteMaterial({ map: TX.glowTexture(), color: 0xff9a40, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 });
  const street = lampPts.filter(p => !p.tunnel), tunL = lampPts.filter(p => p.tunnel);
  const poleI = new THREE.InstancedMesh(poleGeo, poleMat, street.length);
  const armI = new THREE.InstancedMesh(armGeo, poleMat, street.length);
  const headI = new THREE.InstancedMesh(headGeo, headMat, street.length + tunL.length);
  const q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), v3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  street.forEach((p, k) => {
    const i = p.i, hw = track.w[i] / 2;
    const PO = HW ? 1.5 : 2.2, PH = HW ? 1.25 : 1;
    const base = new THREE.Vector3(track.x[i] + track.nx[i] * p.side * (hw + PO), track.y[i] - 0.1, track.z[i] + track.nz[i] * p.side * (hw + PO));
    const yaw = Math.atan2(-track.nx[i] * p.side, -track.nz[i] * p.side);
    q.setFromAxisAngle(up, yaw);
    m4.compose(v3.set(base.x, base.y + 4 * PH, base.z), q, sc.set(1, PH, 1)); poleI.setMatrixAt(k, m4); sc.set(1, 1, 1);
    m4.compose(v3.set(base.x - track.nx[i] * p.side * 1.0, base.y + 7.95 * PH, base.z - track.nz[i] * p.side * 1.0), q, sc); armI.setMatrixAt(k, m4);
    m4.compose(v3.set(p.x, base.y + 7.85 * PH, p.z), q, sc); headI.setMatrixAt(k, m4);
    const s = new THREE.Sprite(glowMat); s.position.set(p.x, base.y + 7.6 * PH, p.z); s.scale.set(HW ? 4 : 5, HW ? 4 : 5, 1); root.add(s);
  });
  tunL.forEach((p, k) => {
    const i = p.i; q.setFromAxisAngle(up, Math.atan2(track.tx[i], track.tz[i]));
    m4.compose(v3.set(p.x, track.y[i] + 6.9, p.z), q, sc); headI.setMatrixAt(street.length + k, m4);
    const s = new THREE.Sprite(tunGlowMat); s.position.set(p.x, track.y[i] + 6.6, p.z); s.scale.set(3, 3, 1); root.add(s);
  });
  root.add(poleI, armI, headI);

  // ---- chevron signs at hairpins ------------------------------------------
  const signGeo = new THREE.PlaneGeometry(2.4, 1.2);
  const postGeo2 = new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5);
  for (const sg of track.signs) {
    const i = sg.i; const outside = -sg.dir; // turning left -> sign on right
    const hw = track.w[i] / 2;
    const ahead = track.idx(i + 10);
    const d = outside * (hw + 2.3);
    const mat = new THREE.MeshStandardMaterial({ map: TX.chevronTexture(sg.dir), emissive: 0xffffff, emissiveMap: TX.chevronTexture(sg.dir), emissiveIntensity: 0.25, roughness: 0.4 });
    const m = new THREE.Mesh(signGeo, mat);
    m.position.set(track.x[ahead] + track.nx[ahead] * d, track.y[ahead] + 1.9, track.z[ahead] + track.nz[ahead] * d);
    // face the oncoming car
    m.lookAt(track.x[i], track.y[ahead] + 1.9, track.z[i]);
    root.add(m);
    const p = new THREE.Mesh(postGeo2, poleMat); p.position.copy(m.position).add(new THREE.Vector3(0, -1.1, 0)); root.add(p);
  }

  // ---- trees (instanced) ----------------------------------------------------
  const treeCount = HW ? 0 : def.terrain === 'ridge' ? 500 : 1500;
  const trunks = [], crowns = [];
  const rr = mulberry(def.id.length * 97 + 13);
  for (let t = 0; t < treeCount * 3 && crowns.length < treeCount; t++) {
    const i = Math.floor(rr() * track.n);
    if (isTunnel(i)) continue;
    const side = rr() < 0.5 ? -1 : 1;
    const up = sideOf(i) === side;
    const dist = track.w[i] / 2 + 6 + rr() * (up ? 50 : 70);
    const d = side * dist;
    const x = track.x[i] + track.nx[i] * d, z = track.z[i] + track.nz[i] * d;
    const j = track.nearest(x, z);
    if (Math.hypot(track.x[j] - x, track.z[j] - z) < track.w[j] / 2 + 5) continue;
    // estimate terrain height using the same column profile
    const rel = dist - (track.w[i] / 2 + 1.6);
    const prof = up ? [[0, 0], [3, 5.5], [9, 11], [20, 20], [42, 34], [75, 52]] : [[0, 0], [5, -5], [12, -13], [26, -26], [50, -46], [90, -70]];
    let h = 0; for (let k = 1; k < prof.length; k++) if (rel <= prof[k][0]) { const f = (rel - prof[k - 1][0]) / (prof[k][0] - prof[k - 1][0]); h = prof[k - 1][1] + (prof[k][1] - prof[k - 1][1]) * f; break; } else h = prof[k][1];
    const y = track.y[i] + h + noise2(x * 0.02, z * 0.02) * 4 - 0.5;
    const s = 0.7 + rr() * 0.9;
    trunks.push([x, y, z, s]); crowns.push([x, y, z, s, rr()]);
  }
  const trunkI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 3, 5), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 }), trunks.length);
  // foliage: crossed alpha-tested cards with painted leaves (cedar + broadleaf), tinted per instance
  const cardGeo = (w, h, y0) => { const g1 = new THREE.PlaneGeometry(w, h); g1.translate(0, y0 + h / 2, 0); const g2 = g1.clone().rotateY(Math.PI / 2); const g3 = g1.clone().rotateY(Math.PI / 4); return mergeGeosUV([g1, g2, g3]); };
  const kinds = [{ tex: TX.treeTexture('cedar'), geo: cardGeo(5.2, 11, 0.6) }, { tex: TX.treeTexture('broad'), geo: cardGeo(7.5, 8.5, 1.0) }];
  const groups = [[], []];
  crowns.forEach((t) => groups[def.terrain === 'autumn' ? (t[4] < 0.3 ? 0 : 1) : (t[4] < 0.62 ? 0 : 1)].push(t));
  const col = new THREE.Color();
  trunks.forEach((t, k) => { m4.compose(v3.set(t[0], t[1] + 1.5 * t[3], t[2]), q.identity(), sc.set(t[3], t[3], t[3])); trunkI.setMatrixAt(k, m4); });
  const crownMeshes = kinds.map((K, gi) => {
    // unlit cards (crossed planes would show their dark back faces); light comes from time of day + baked lamps
    const mat = new THREE.MeshBasicMaterial({ map: K.tex, alphaTest: 0.45, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(K.geo, mat, Math.max(1, groups[gi].length));
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: K.tex, alphaTest: 0.45 });
    groups[gi].forEach((t, k) => {
      m4.compose(v3.set(t[0], t[1], t[2]), q.setFromAxisAngle(up, t[4] * 6), sc.set(t[3], t[3] * (0.9 + t[4] * 0.4), t[3])); mesh.setMatrixAt(k, m4);
      const dayF = (opts.time || def.time) === 'day' ? (wet ? 0.75 : 1.05) : (opts.time || def.time) === 'dusk' ? 0.55 : 0.13; const vr = 0.85 + t[4] * 0.3;
      lightAt(t[0], t[1] + 4, t[2], col); col.setRGB((dayF + col.r * 0.7) * vr, (dayF + col.g * 0.7) * vr, (dayF * 0.95 + col.b * 0.5) * vr);
      if (def.terrain === 'autumn' && gi === 1) { const A = [[2.0, 0.6, 0.35], [2.1, 1.25, 0.4], [1.9, 1.6, 0.45], [1.0, 1.25, 0.7], [1.9, 0.45, 0.3]][Math.floor(t[4] * 5)]; col.r *= A[0] * 0.75; col.g *= A[1] * 0.75; col.b *= A[2]; }
      if (def.terrain === 'ridge') col.g *= 1.1;
      mesh.setColorAt(k, col);
    });
    if (!groups[gi].length) mesh.count = 0;
    mesh.castShadow = true; mesh.receiveShadow = false; return mesh;
  });
  const crownI = crownMeshes[0]; root.add(crownMeshes[1]);
  sc.set(1, 1, 1);
  trunkI.castShadow = crownI.castShadow = true;
  root.add(trunkI, crownI);

  // ---- start / goal gates ------------------------------------------------
  const gate = (s, text, color) => {
    const p = track.pointAt(s);
    const i = p.i, hw = track.w[i] / 2 + 2.2;
    const g = new THREE.Group();
    g.position.set(p.x, track.y[i], p.z); g.rotation.y = p.yaw;
    const legMat = new THREE.MeshStandardMaterial({ color: 0x222226, metalness: 0.7, roughness: 0.4 });
    for (const sd of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6.4, 0.4), legMat); leg.position.set(sd * hw, 3.2, 0); g.add(leg); }
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2 + 0.6, 1.6), new THREE.MeshBasicMaterial({ map: TX.bannerTexture(text, color), side: THREE.DoubleSide }));
    ban.position.set(0, 5.8, 0); ban.rotation.y = Math.PI; g.add(ban);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(track.w[i], 1.2), new THREE.MeshStandardMaterial({ map: TX.checkerTexture(), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }));
    line.rotation.x = -Math.PI / 2; line.position.y = 0.06; g.add(line);
    const bulb = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowTexture('rgba(255,255,255,1)', 'rgba(255,200,120,0)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    bulb.position.set(0, 6.9, 0); bulb.scale.set(14, 3, 1); g.add(bulb);
    root.add(g); return g;
  };
  gate(track.closed ? 0.5 : 14, track.closed ? 'CONTROL LINE' : 'START', '#ff7a00');
  if (!track.closed) gate(track.length - 4, 'GOAL', '#ffd000');

  // ---- sky, distant mountains, stars -----------------------------------------
  const skyGeo = new THREE.SphereGeometry(3000, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { c0: { value: new THREE.Color(time.sky[0]) }, c1: { value: new THREE.Color(time.sky[1]) }, c2: { value: new THREE.Color(time.sky[2]) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 c0,c1,c2; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h>0.0 ? mix(c1,c0,smoothstep(0.0,0.6,h)) : c1; c = mix(c, c2, pow(max(0.0,1.0-abs(h)*3.0),3.0)*0.8); gl_FragColor = vec4(c,1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat); sky.name = 'sky'; sky.renderOrder = -10;
  const skyGroup = new THREE.Group(); skyGroup.add(sky);
  if (opts.time !== 'day' && (opts.time || def.time) === 'night' && !wet) {
    const sp = []; const r2 = mulberry(5);
    for (let k = 0; k < 1600; k++) { const u = r2() * Math.PI * 2, vv = Math.acos(1 - r2() * 0.9); sp.push(Math.cos(u) * Math.sin(vv) * 2800, Math.cos(vv) * 2800, Math.sin(u) * Math.sin(vv) * 2800); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    skyGroup.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
    // moon
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowTexture('rgba(255,255,240,1)', 'rgba(150,170,255,0)'), fog: false, depthWrite: false, transparent: true }));
    moon.position.set(-1200, 1300, -1800); moon.scale.set(260, 260, 1); skyGroup.add(moon);
  }
  const ring = (radius, h, color, seed, y) => {
    const g = new THREE.CylinderGeometry(radius, radius, h, 64, 1, true);
    const m = new THREE.MeshBasicMaterial({ map: TX.mountainTexture(color, seed, 1.4), transparent: true, side: THREE.BackSide, fog: false, depthWrite: false });
    m.map.repeat.set(3, 1);
    const mesh = new THREE.Mesh(g, m); mesh.position.y = y; return mesh;
  };
  const T = opts.time || def.time;
  if (T === 'day' && !wet) {
    // sun disc + soft glare, drifting cumulus
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowTexture('rgba(255,255,245,1)', 'rgba(255,240,200,0)'), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    sun.position.set(-1250, 2050, -1650).setLength(2700); sun.scale.set(520, 520, 1); skyGroup.add(sun);
    const cr = mulberry(77);
    for (let k = 0; k < 26; k++) {
      const a = cr() * Math.PI * 2, el = 0.12 + cr() * 0.32, R = 2500;
      const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.cloudTexture(k % 5), fog: false, depthWrite: false, transparent: true, opacity: 0.85 + cr() * 0.15 }));
      c.position.set(Math.cos(a) * Math.cos(el) * R, Math.sin(el) * R, Math.sin(a) * Math.cos(el) * R);
      const w = 500 + cr() * 700; c.scale.set(w, w * (0.32 + cr() * 0.15), 1); skyGroup.add(c);
    }
  }
  if (HW) { // city skyline all around instead of mountains
    for (const [rad, hh, y, rep] of [[2400, 520, 120, 3], [1900, 380, 60, 4]]) { const m = new THREE.MeshBasicMaterial({ map: TX.skylineTexture().clone(), transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }); m.map.repeat.set(rep, 1); m.map.needsUpdate = true; const ring = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, hh, 64, 1, true), m); ring.position.y = y; skyGroup.add(ring); }
  }
  const tone = T === 'dusk' ? ['#3a2038', '#1c1024'] : T === 'day' ? (wet ? ['#4a5560', '#3a444c'] : ['#6f8aa0', '#4f6b78']) : ['#0b1226', '#050913'];
  if (!HW) skyGroup.add(ring(2500, 900, tone[0], 2, 150), ring(2000, 700, tone[1], 3, 80));
  root.add(skyGroup);

  // valley floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshStandardMaterial({ color: T === 'dusk' ? 0x1a1820 : T === 'day' ? 0x2c3d28 : 0x05070a, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set((track.bounds.minX + track.bounds.maxX) / 2, track.bounds.minY - (HW ? 14 : 90), (track.bounds.minZ + track.bounds.maxZ) / 2);
  root.add(floor);

  // ---- course-specific landmark detail (lake, summit lodge, utility poles, gutters, hairpin boards) ----
  const rev = track.dir === 'rev';
  const fS = (v) => rev ? track.length - v : v, fSide = (sd) => rev ? -sd : sd;
  const idxAt = (v) => track.pointAt(v).i;
  if (def.lake) {
    const L = def.lake, side = fSide(L.side);
    const a = Math.min(fS(L.from), fS(L.to)), b = Math.max(fS(L.from), fS(L.to));
    let ymin = 1e9; const inner = [], outer = [];
    for (let v = a; v <= b; v += 6) {
      const i = idxAt(v), hw = track.w[i] / 2; ymin = Math.min(ymin, track.y[i]);
      const di = side * (hw + 16), dO = side * (hw + 420);
      inner.push([track.x[i] + track.nx[i] * di, track.z[i] + track.nz[i] * di]);
      outer.push([track.x[i] + track.nx[i] * dO, track.z[i] + track.nz[i] * dO]);
    }
    const sh = new THREE.Shape(); sh.moveTo(inner[0][0], -inner[0][1]);
    for (const p of inner) sh.lineTo(p[0], -p[1]);
    for (const p of outer.reverse()) sh.lineTo(p[0], -p[1]);
    const wg = new THREE.ShapeGeometry(sh, 4); wg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: T === 'day' ? 0x2a5a70 : 0x0a1a26, roughness: 0.06, metalness: 0.65, transparent: true, opacity: 0.94 }));
    water.position.y = ymin - 1.6; water.receiveShadow = true; water.name = 'lake'; root.add(water);
    // shoreline stones + a small pier with lanterns
    const stoneM = new THREE.MeshStandardMaterial({ color: 0x6b6a64, roughness: 1, flatShading: true });
    const stoneG = new THREE.DodecahedronGeometry(1, 0); const stones = new THREE.InstancedMesh(stoneG, stoneM, inner.length * 2);
    const sm = new THREE.Matrix4(); let sc0 = 0;
    inner.reverse().forEach((p, k) => { for (const o of [0, 1]) { const r = 0.6 + ((k * 7 + o * 3) % 5) * 0.25; sm.compose(new THREE.Vector3(p[0] + o * 1.5, ymin - 1.6, p[1] + o), new THREE.Quaternion().setFromEuler(new THREE.Euler(k, o, k * 0.3)), new THREE.Vector3(r * 1.4, r * 0.7, r)); stones.setMatrixAt(sc0++, sm); } });
    root.add(stones);
    const mid = idxAt((a + b) / 2), hwm = track.w[mid] / 2;
    const pier = new THREE.Group(); const wood = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 26), wood); deck.position.set(0, 0, 13); pier.add(deck);
    for (let z = 2; z < 26; z += 4) for (const x of [-1.3, 1.3]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 6), wood); post.position.set(x, -1.8, z); pier.add(post); }
    for (const z of [6, 16, 25]) { const ln = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.3), new THREE.MeshBasicMaterial({ color: T === 'day' ? 0xddd2b0 : 0xffc070 })); ln.position.set(1.3, 0.9, z); pier.add(ln); if (T !== 'day') { const gs = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowTexture(), color: 0xffa040, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); gs.position.copy(ln.position); gs.scale.set(3, 3, 1); pier.add(gs); } }
    pier.position.set(track.x[mid] + track.nx[mid] * side * (hwm + 14), ymin - 1.1, track.z[mid] + track.nz[mid] * side * (hwm + 14));
    pier.rotation.y = Math.atan2(track.nx[mid] * side, track.nz[mid] * side); root.add(pier);
  }
  if (def.lodge) {
    const side = fSide(def.lodge.side), i = idxAt(fS(def.lodge.s)), hw = track.w[i] / 2;
    const g = new THREE.Group();
    const base = new THREE.Vector3(track.x[i] + track.nx[i] * side * (hw + 16), track.y[i] - 0.05, track.z[i] + track.nz[i] * side * (hw + 16));
    g.position.copy(base); g.rotation.y = Math.atan2(-track.nx[i] * side, -track.nz[i] * side); root.add(g);
    const wallM = lampify(new THREE.MeshStandardMaterial({ color: 0xd8cfbf, roughness: 0.85 }), 0.8);
    const roofM = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.6, metalness: 0.3 });
    const asphalt = lampify(new THREE.MeshStandardMaterial({ map: TX.roadTexture(wet), roughness: 0.9, color: 0x9a9a9a }), 1);
    const lot = new THREE.Mesh(new THREE.BoxGeometry(34, 0.3, 26), asphalt); lot.position.set(0, -0.12, 0); g.add(lot);
    const found = new THREE.Mesh(new THREE.BoxGeometry(34, 30, 26), new THREE.MeshStandardMaterial({ color: 0x55534e, roughness: 1, map: TX.rockTexture() })); found.position.set(0, -15.3, 0); g.add(found);
    for (let k = -2; k <= 2; k++) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 5), new THREE.MeshBasicMaterial({ color: 0xdddddd })); ln.rotation.x = -Math.PI / 2; ln.position.set(k * 3, 0.05, -4); g.add(ln); }
    const house = (w, h, d, x, z, sign) => {
      const hb = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallM); hb.position.set(x, h / 2, z); g.add(hb);
      const rs = new THREE.Shape(); rs.moveTo(-w / 2 - 0.5, 0); rs.lineTo(0, h * 0.45); rs.lineTo(w / 2 + 0.5, 0); rs.closePath();
      const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: d + 1, bevelEnabled: false }), roofM); roof.position.set(x, h, z - d / 2 - 0.5); g.add(roof);
      const winM = new THREE.MeshStandardMaterial({ color: 0x223040, emissive: T === 'day' ? 0x000000 : 0xffc880, emissiveIntensity: T === 'day' ? 0 : 1.2, roughness: 0.1, metalness: 0.5 });
      for (let k = 0; k < Math.floor(w / 2.6); k++) { const wn = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), winM); wn.position.set(x - w / 2 + 1.5 + k * 2.6, h * 0.55, z + d / 2 + 0.02); g.add(wn); }
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.2), new THREE.MeshStandardMaterial({ color: 0x4a3626 })); door.position.set(x + w / 2 - 1.4, 1.1, z + d / 2 + 0.02); g.add(door);
      if (sign) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 1.1), new THREE.MeshBasicMaterial({ map: TX.signTexture(sign, '', '#7a1a14') })); sg.position.set(x, h + 0.2, z + d / 2 + 0.3); g.add(sg); }
    };
    house(14, 4.2, 8, -6, 6, '湖畔レストハウス');
    house(8, 3.4, 6, 9, 8, '');
    // vending machines with glow (look like the roadside ones at every Japanese pass)
    const vmCols = [0xd0202a, 0x1a4fbf, 0xf2f2f2];
    vmCols.forEach((c, k) => {
      const vm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.85, 0.75), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, emissive: c, emissiveIntensity: T === 'day' ? 0.05 : 0.35 }));
      vm.position.set(2 + k * 1.1, 0.93, 1.6); g.add(vm);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.9), new THREE.MeshBasicMaterial({ color: T === 'day' ? 0xcfe8ff : 0xf6fbff })); panel.position.set(2 + k * 1.1, 1.2, 1.98); g.add(panel);
    });
    if (T !== 'day') { const vg = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowTexture('rgba(230,245,255,0.9)', 'rgba(150,200,255,0)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); vg.position.set(3.1, 1.2, 2.6); vg.scale.set(6, 4, 1); g.add(vg); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  if (def.gutters) {
    const gutM = lampify(new THREE.MeshStandardMaterial({ color: 0x8d8a83, roughness: 0.95, map: TX.gravelTexture() }), 0.9);
    ribbon(i => {
      if (isTunnel(i)) return null;
      const side = sideOf(i), hw = track.w[i] / 2, b = track.bank[i], e = side * hw, y0 = e * b + crown(hw, hw) + 0.02;
      const pts = [{ d: e + side * 0.12, h: y0, u: 0 }, { d: e + side * 0.16, h: y0 - 0.3, u: 0.3 }, { d: e + side * 0.62, h: y0 - 0.3, u: 0.7 }, { d: e + side * 0.66, h: y0 + 0.02, u: 1 }];
      return side > 0 ? pts : pts.reverse();
    }, 3, gutM);
  }
  if (def.utilityPoles) {
    const poleM = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.9 });
    const pG = new THREE.CylinderGeometry(0.13, 0.17, 10, 7); pG.translate(0, 5, 0);
    const armG = new THREE.BoxGeometry(1.8, 0.1, 0.1); armG.translate(0, 9.2, 0);
    const pts = []; const wires = [];
    let prev = null;
    for (let v = 8; v < track.length - 8; v += 34) {
      const i = idxAt(v); if (isTunnel(i)) { prev = null; continue; }
      const side = -sideOf(i); const hw = track.w[i] / 2 + 2.6;
      const x = track.x[i] + track.nx[i] * side * hw, z = track.z[i] + track.nz[i] * side * hw, y = track.y[i] - 0.2;
      // skip if it would stand on another part of the road (switchbacks)
      const j = track.nearest(x, z, -1, y); if (Math.abs(track.s[j] - track.s[i]) > 30 && Math.hypot(track.x[j] - x, track.z[j] - z) < track.w[j] / 2 + 2) { prev = null; continue; }
      const cur = { x, y, z, yaw: Math.atan2(track.tx[i], track.tz[i]), side };
      pts.push(cur);
      if (prev && prev.side === side && Math.hypot(prev.x - x, prev.z - z) < 48) {
        for (const off of [-0.8, 0, 0.8]) {
          const ox0 = Math.cos(prev.yaw) * off, oz0 = -Math.sin(prev.yaw) * off, ox1 = Math.cos(cur.yaw) * off, oz1 = -Math.sin(cur.yaw) * off;
          let last = null;
          for (let t = 0; t <= 1.0001; t += 0.125) {
            const px = prev.x + ox0 + (x + ox1 - prev.x - ox0) * t, pz = prev.z + oz0 + (z + oz1 - prev.z - oz0) * t;
            const py = prev.y + 9.3 + (y - prev.y) * t - Math.sin(Math.PI * t) * 0.9;
            if (last) wires.push(last[0], last[1], last[2], px, py, pz); last = [px, py, pz];
          }
        }
      }
      prev = cur;
    }
    const pI = new THREE.InstancedMesh(pG, poleM, pts.length), aI = new THREE.InstancedMesh(armG, poleM, pts.length);
    const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    pts.forEach((p, k) => { qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw); mm.compose(new THREE.Vector3(p.x, p.y, p.z), qq, one); pI.setMatrixAt(k, mm); aI.setMatrixAt(k, mm); });
    pI.castShadow = aI.castShadow = true; root.add(pI, aI);
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
    root.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.8 })));
  }
  if (def.barrier) {
    // closed-road barricade at the start ("進入禁止"), like the old pass roads
    const p0 = track.pointAt(rev ? track.length - 30 : 30), i0 = p0.i, side = 1, hw = track.w[i0] / 2 + 1.0;
    const g = new THREE.Group(); g.position.set(track.x[i0] + track.nx[i0] * side * hw, track.y[i0], track.z[i0] + track.nz[i0] * side * hw); g.rotation.y = p0.yaw + Math.PI / 2; root.add(g);
    const st = new THREE.MeshStandardMaterial({ color: 0xd8b020, metalness: 0.4, roughness: 0.5 });
    for (const x of [-1.2, 1.2]) for (const z of [-0.35, 0.35]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 0.06), st); leg.position.set(x, 0.62, z); leg.rotation.x = z > 0 ? -0.25 : 0.25; g.add(leg); }
    const bt = TX.signTexture('進入禁止', 'ROAD CLOSED', '#b01010');
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.75), new THREE.MeshStandardMaterial({ map: bt, side: THREE.DoubleSide, roughness: 0.6 })); board.position.y = 1.05; g.add(board);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.18), new THREE.MeshBasicMaterial({ map: TX.chevronTexture(1), side: THREE.DoubleSide })); stripe.position.y = 0.6; g.add(stripe);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }
  if (def.hairpinNumbers) {
    const seen = new Set();
    for (let i = 0; i < track.n; i++) {
      const hp = track.flags[i].hp; if (!hp || seen.has(hp)) continue; seen.add(hp);
      const ia = track.idx(i - 14), sd = track.flags[i].signDir, side = sd > 0 ? 1 : -1; // inside of the corner
      const hw = track.w[ia] / 2 + 2.4;
      const n = rev ? 6 - hp : hp;
      const bd = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshStandardMaterial({ map: TX.signTexture(`第${n}ヘアピン`, `HAIRPIN ${n}`, '#1a5fd0'), emissive: 0xffffff, emissiveMap: TX.signTexture(`第${n}ヘアピン`, `HAIRPIN ${n}`, '#1a5fd0'), emissiveIntensity: 0.15 }));
      bd.position.set(track.x[ia] + track.nx[ia] * side * hw, track.y[ia] + 2.6, track.z[ia] + track.nz[ia] * side * hw);
      bd.lookAt(track.x[track.idx(ia - 20)], track.y[ia] + 2.6, track.z[track.idx(ia - 20)]); root.add(bd);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5), new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.6 })); post.position.copy(bd.position).add(new THREE.Vector3(0, -1.5, 0)); root.add(post);
    }
  }

  // ---- expressway: parapets, sound walls, piers, city blocks, overhead signs ----
  if (HW) {
    const ground = track.bounds.minY - 14;
    const conc = lampify(new THREE.MeshStandardMaterial({ color: 0xa8aaa6, roughness: 0.85, map: TX.gravelTexture() }), 1.0);
    // concrete parapet walls (instead of guardrails) with a reflector line
    for (const side of [-1, 1]) {
      ribbon(i => { if (isTunnel(i)) return null; const hw = track.w[i] / 2 + 1.2, b = track.bank[i], e = side * hw, y0 = e * b - 0.05;
        const pts = [{ d: e, h: y0, u: 0 }, { d: e + side * 0.05, h: y0 + 0.95, u: 0.5 }, { d: e + side * 0.35, h: y0 + 1.0, u: 0.7 }, { d: e + side * 0.4, h: y0 - 1.6, u: 1 }];
        return side > 0 ? pts : pts.reverse(); }, 6, conc);
    }
    // translucent sound walls on long stretches
    const swMat = new THREE.MeshStandardMaterial({ color: 0x9ab8c8, transparent: true, opacity: 0.35, roughness: 0.15, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false });
    for (const side of [-1, 1]) ribbon(i => { if (isTunnel(i) || Math.sin(track.s[i] / 300 + side) < 0.1) return null; const hw = track.w[i] / 2 + 1.42, e = side * hw, y0 = e * track.bank[i] + 0.95;
      const pts = [{ d: e, h: y0, u: 0 }, { d: e, h: y0 + 3.2, u: 1 }]; return side > 0 ? pts : pts.reverse(); }, 4, swMat);
    // deck underside + piers down to the ground
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x6a6c6a, roughness: 0.9 });
    ribbon(i => { if (isTunnel(i)) return null; const hw = track.w[i] / 2 + 1.6; return [{ d: hw, h: -1.6, u: 0 }, { d: -hw, h: -1.6, u: 1 }]; }, 10, deckMat);
    const pierGeo = new THREE.BoxGeometry(2.2, 1, 2.2), capGeo = new THREE.BoxGeometry(1, 1.2, 2.6);
    const piers = [], caps = [];
    for (let i = 0; i < track.n; i += 18) { if (isTunnel(i)) continue; const h = track.y[i] - 1.6 - ground; if (h < 2) continue; piers.push([track.x[i], ground + h / 2, track.z[i], h, Math.atan2(track.tx[i], track.tz[i]), track.w[i] + 3]); }
    const pI = new THREE.InstancedMesh(pierGeo, deckMat, Math.max(1, piers.length)), cI = new THREE.InstancedMesh(capGeo, deckMat, Math.max(1, piers.length));
    piers.forEach((p, k) => { q.setFromAxisAngle(up, p[4]); m4.compose(v3.set(p[0], p[1], p[2]), q, sc.set(1, p[3], 1)); pI.setMatrixAt(k, m4); m4.compose(v3.set(p[0], p[1] + p[3] / 2 - 0.6, p[2]), q, sc.set(p[5], 1, 1)); cI.setMatrixAt(k, m4); });
    pI.count = cI.count = piers.length; sc.set(1, 1, 1); root.add(pI, cI);
    // city blocks: instanced towers with lit-window facades, kept clear of the road
    const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
    const towers = [[], [], []]; const br = mulberry(def.id.length * 131);
    for (let k = 0; k < 900; k++) {
      const i = Math.floor(br() * track.n); if (isTunnel(i)) continue;
      const side = br() < 0.5 ? -1 : 1, dist = track.w[i] / 2 + 45 + br() * 280;
      const x = track.x[i] + track.nx[i] * side * dist, z = track.z[i] + track.nz[i] * side * dist;
      const j = track.nearest(x, z); if (Math.hypot(track.x[j] - x, track.z[j] - z) < track.w[j] / 2 + 38) continue;
      const w = 14 + br() * 26, d = 14 + br() * 26, h = 18 + Math.pow(br(), 1.6) * 150;
      towers[k % 3].push([x, ground, z, w, h, d, br() * 6.28]);
    }
    towers.forEach((list, v) => {
      if (!list.length) return;
      const t = TX.buildingTexture(v + 1).clone(); t.needsUpdate = true;
      const mat = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: T === 'day' ? 0.05 : 0.9, color: T === 'day' ? 0x9aa4b0 : 0x5a606a, roughness: 0.4, metalness: 0.5 });
      const I = new THREE.InstancedMesh(bGeo, mat, list.length);
      list.forEach((b, k) => { q.setFromAxisAngle(up, b[6]); m4.compose(v3.set(b[0], b[1], b[2]), q, sc.set(b[3], b[4], b[5])); I.setMatrixAt(k, m4); });
      sc.set(1, 1, 1); root.add(I);
    });
    // aircraft warning lights on the tallest towers
    const warn = [].concat(...towers).filter(b => b[4] > 110);
    if (warn.length && T !== 'day') { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(warn.flatMap(b => [b[0], b[1] + b[4] + 1, b[2]]), 3)); root.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xff2020, size: 5, sizeAttenuation: false }))); }
    // overhead sign gantries (original destinations)
    const dests = [['湾岸線', 'BAYSHORE RT'], ['臨港', 'PORT AREA 2km'], ['都心環状', 'C-RING'], ['空港', 'AIRPORT 5km'], ['新港JCT', 'SHINKO JCT']];
    const gm = new THREE.MeshStandardMaterial({ color: 0x8a8e94, metalness: 0.7, roughness: 0.4 });
    let gk = 0;
    for (let s0 = 400; s0 < track.length - 100; s0 += 650) {
      const p = track.pointAt(s0); if (isTunnel(p.i)) continue; const hw = track.w[p.i] / 2 + 1.4;
      const gGroup = new THREE.Group(); gGroup.position.set(p.x, track.y[p.i], p.z); gGroup.rotation.y = p.yaw; root.add(gGroup);
      for (const sd of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 7.2, 0.35), gm); post.position.set(sd * hw, 3.6, 0); gGroup.add(post); }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.4, 0.4), gm); beam.position.y = 7; gGroup.add(beam);
      const [jp, en] = dests[gk++ % dests.length]; const st = TX.signTexture(jp, en, '#0d6a3a');
      const board = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.0), new THREE.MeshStandardMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.35, side: THREE.DoubleSide })); board.position.set(hw * 0.35, 5.6, -0.25); board.rotation.y = Math.PI; gGroup.add(board);
      const b2 = board.clone(); b2.material = b2.material.clone(); const st2 = TX.signTexture(['出口', 'EXIT'][0], ['', 'EXIT 1km'][1], '#0d6a3a'); b2.material.map = st2; b2.material.emissiveMap = st2; b2.position.x = -hw * 0.45; b2.scale.set(0.7, 1, 1); gGroup.add(b2);
    }
  }

  // ---- lighting ---------------------------------------------------------
  const hemi = new THREE.HemisphereLight(time.sky[2], T === 'day' ? 0x3a3020 : 0x0a0a10, wet && T === 'day' ? time.amb * 0.8 : time.amb);
  const moonL = new THREE.DirectionalLight(T === 'dusk' ? 0xffb080 : T === 'day' ? 0xfff1dc : 0x8fa8ff, wet && T === 'day' ? time.moon * 0.35 : time.moon);
  const sunDir = new THREE.Vector3(-300, 500, -400).normalize();
  moonL.position.copy(sunDir).multiplyScalar(120);
  // real-time shadows: a tight shadow frustum that follows the camera target
  moonL.castShadow = true;
  moonL.shadow.mapSize.set(2048, 2048);
  const SC = moonL.shadow.camera; SC.left = -45; SC.right = 45; SC.top = 45; SC.bottom = -45; SC.near = 1; SC.far = 320;
  moonL.shadow.bias = -0.0004; moonL.shadow.normalBias = 0.04;
  moonL.shadow.intensity = T === 'night' ? 0.55 : 1;
  root.add(hemi, moonL, moonL.target);
  root.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && !o.material.alphaTest) { o.receiveShadow = true; } });
  const shadowFollow = (p) => { moonL.target.position.copy(p); moonL.position.copy(p).addScaledVector(sunDir, 160); };

  // ---- rain -------------------------------------------------------------
  let rain = null;
  if (wet) {
    const N = 6000; const rp = new Float32Array(N * 6);
    for (let k = 0; k < N; k++) { const x = (Math.random() - .5) * 80, y = Math.random() * 40, z = (Math.random() - .5) * 80; rp.set([x, y, z, x + 0.05, y - 0.7, z], k * 6); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9fb4d0, transparent: true, opacity: 0.35 }));
    rain.frustumCulled = false; root.add(rain);
  }

  const fog = new THREE.Fog(wet ? 0x10141c : time.fog, wet ? 20 : time.fogNear, wet ? 260 : time.fogFar);

  return {
    root, fog, skyGroup, rain, lightAt, sun: moonL, shadowFollow, grip: wet ? 0.78 : 1.0,
    update(cam, dt) {
      skyGroup.position.copy(cam.position);
      if (rain) {
        rain.position.set(cam.position.x, cam.position.y - 15, cam.position.z);
        const a = rain.geometry.attributes.position.array;
        for (let k = 0; k < a.length; k += 6) {
          a[k + 1] -= 32 * dt; a[k + 4] -= 32 * dt;
          if (a[k + 1] < 0) { a[k + 1] += 40; a[k + 4] += 40; }
        }
        rain.geometry.attributes.position.needsUpdate = true;
      }
    },
  };
}

// ---------------------------------------------------------------------------
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
export function mergeGeosUV(geos) {
  const pos = [], nor = [], uv = [], idx = []; let off = 0;
  for (const g of geos) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(0, 1, 0); uv.push(u.getX(i), u.getY(i)); }
    for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
    off += p.count; void n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx); return out;
}
export function mergeGeos(geos) {
  const pos = [], nor = [], idx = []; let off = 0;
  for (const g0 of geos) {
    const g = g0.index ? g0 : g0; const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
    else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx); return out;
}
