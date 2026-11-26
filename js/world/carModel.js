// REVOLUTION DRIVE — procedural 3D car models (original designs)
// Bodies are extruded from side profiles with real wheel-arch cut-outs, and every
// dress-up option (paint, wheels, spoiler, aero, muffler) changes the actual geometry.
import * as THREE from 'three';
import { PAINTS, WHEELS, SPOILERS, AEROS, MUFFLERS, RIDE_HEIGHTS } from '../data/cars.js';
import * as TX from './textures.js';

// normalised side profiles: x from rear (-0.5) to front (+0.5), y as fraction of body height
const PROFILES = {
  coupe: {
    lower: [[-0.5, 0.30], [-0.5, 0.52], [-0.47, 0.60], [-0.30, 0.62], [0.30, 0.58], [0.46, 0.50], [0.5, 0.40], [0.5, 0.28]],
    cabin: [[-0.36, 0.60], [-0.14, 0.97], [0.07, 0.99], [0.30, 0.60]],
  },
  hatch: {
    lower: [[-0.5, 0.30], [-0.5, 0.56], [-0.48, 0.63], [-0.30, 0.64], [0.28, 0.60], [0.45, 0.52], [0.5, 0.42], [0.5, 0.28]],
    cabin: [[-0.47, 0.62], [-0.40, 0.95], [0.05, 0.99], [0.27, 0.61]],
  },
  roadster: {
    lower: [[-0.5, 0.32], [-0.5, 0.56], [-0.46, 0.66], [-0.30, 0.68], [0.30, 0.62], [0.46, 0.52], [0.5, 0.42], [0.5, 0.30]],
    cabin: [[-0.16, 0.66], [-0.12, 0.70], [0.02, 0.96], [0.08, 0.96], [0.20, 0.64]],
  },
  sedan: {
    lower: [[-0.5, 0.30], [-0.5, 0.55], [-0.47, 0.62], [-0.28, 0.63], [0.30, 0.58], [0.46, 0.50], [0.5, 0.40], [0.5, 0.28]],
    cabin: [[-0.30, 0.62], [-0.18, 0.96], [0.10, 0.98], [0.30, 0.60]],
  },
};

let envMap = null;
export function setEnvMap(e) { envMap = e; }

export function buildEnvMap(renderer) {
  // small studio/night environment for reflections
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 p; void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec3 p; void main(){
      float h=p.y; vec3 c=mix(vec3(0.02,0.025,0.04), vec3(0.18,0.22,0.32), smoothstep(-0.2,0.7,h));
      float strip = smoothstep(0.97,1.0, 1.0-abs(p.y-0.35)*6.0) * step(0.0,sin(atan(p.z,p.x)*6.0));
      c += vec3(1.0,0.95,0.85)*strip*2.0;
      c += vec3(1.0,0.6,0.2)*pow(max(0.0,1.0-abs(h+0.05)*8.0),3.0)*0.6;
      gl_FragColor=vec4(c,1.0);}`,
  });
  scene.add(new THREE.Mesh(geo, mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.02);
  envMap = rt.texture;
  return envMap;
}

const glassMat = () => new THREE.MeshPhysicalMaterial({ color: 0x0a0d12, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.88, envMap, envMapIntensity: 1.4, clearcoat: 1 });
const blackMat = () => new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.65, metalness: 0.2, envMap });
const chromeMat = () => new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.15, metalness: 1, envMap });

function profileShape(pts, len, hgt, archs) {
  // pts are the upper outline (rear -> front). bottom edge gets wheel-arch cutouts.
  const s = new THREE.Shape();
  const P = pts.map(([x, y]) => [x * len, y * hgt]);
  s.moveTo(P[0][0], P[0][1]);
  // rounded corners: quadratic curves through mid-points of the polyline
  for (let i = 1; i < P.length - 1; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[i + 1];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    if (i === 1) s.lineTo((P[0][0] + x0) / 2, (P[0][1] + y0) / 2);
    s.quadraticCurveTo(x0, y0, i === P.length - 2 ? x1 : mx, i === P.length - 2 ? y1 : my);
  }
  // bottom from front to rear with arches
  const bottom = 0.30 * hgt * 0.62;
  const front = P[P.length - 1];
  s.lineTo(front[0] - 0.02, bottom);
  const sorted = archs.slice().sort((a, b) => b.x - a.x);
  for (const a of sorted) {
    s.lineTo(a.x + a.r, bottom);
    s.absarc(a.x, a.cy, a.r, 0, Math.PI, false);
    s.lineTo(a.x - a.r, bottom);
  }
  s.lineTo(P[0][0] + 0.02, bottom);
  s.closePath();
  return s;
}

function extrude(shape, width, bevel = 0.07, seg = 3) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.1, width - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: seg, curveSegments: 18 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2); // length axis x -> z
  g.computeVertexNormals();
  return g;
}

function wheelMesh(style, R, W, rimColor) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(R, R, W, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9, side: THREE.DoubleSide }));
  const back = new THREE.Mesh(new THREE.CircleGeometry(R * 0.7, 20), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, side: THREE.DoubleSide })); back.rotation.y = Math.PI / 2; back.position.x = -W * 0.1; g.add(back);
  tire.rotation.z = Math.PI / 2; g.add(tire);
  // sidewall bulge
  const wall = new THREE.Mesh(new THREE.TorusGeometry(R * 0.86, W * 0.32, 8, 28), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 }));
  wall.rotation.y = Math.PI / 2; wall.position.x = W * 0.3; g.add(wall);
  const rimMat = new THREE.MeshStandardMaterial({ color: rimColor, metalness: 0.85, roughness: 0.28, envMap });
  const rimR = R * 0.68;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, W * 0.9, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide, envMap }));
  barrel.rotation.z = Math.PI / 2; g.add(barrel);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.018, 6, 28), rimMat); lip.rotation.y = Math.PI / 2; lip.position.x = W * 0.46; g.add(lip);
  const face = new THREE.Group(); face.position.x = W * 0.36;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.22, rimR * 0.22, 0.05, 12), rimMat); hub.rotation.z = Math.PI / 2; face.add(hub);
  const n = style.spokes;
  for (let i = 0; i < n; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.035, rimR * 0.82, n > 8 ? 0.028 : 0.055), rimMat);
    sp.position.y = rimR * 0.5; const piv = new THREE.Group(); piv.add(sp); piv.rotation.x = i / n * Math.PI * 2; face.add(piv);
  }
  g.add(face);
  // brake disc + caliper (does not spin)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.85, rimR * 0.85, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.9, roughness: 0.35 }));
  disc.rotation.z = Math.PI / 2; disc.position.x = W * 0.15;
  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.12), new THREE.MeshStandardMaterial({ color: 0xd01010, roughness: 0.4 }));
  caliper.position.set(W * 0.2, rimR * 0.55, -0.05);
  return { spin: g, disc, caliper };
}

export function createCar(spec, dress = {}, opts = {}) {
  const b = spec.body;
  const len = b.len, hgt = b.hgt;
  const aero = dress.aero || 'stock';
  const wide = aero === 'wide' ? 0.08 : 0;
  const wid = b.wid + wide * 2;
  const prof = PROFILES[b.style] || PROFILES.coupe;
  const paint = PAINTS.find(p => p.id === dress.paint) || PAINTS[0];
  const wheelStyle = WHEELS.find(w => w.id === dress.wheel) || WHEELS[0];
  const R = spec.tire.radius, TW = spec.tire.width / 1000 + 0.02;
  const wb = spec.wheelbase;
  const axleOffset = 0.04 * len; // body slightly forward of wheelbase centre
  const fz = wb / 2 + axleOffset * 0, rz = -wb / 2;
  const root = new THREE.Group();
  const body = new THREE.Group(); // pitch/roll applied here
  root.add(body);

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paint.hex), metalness: 0.45, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06, envMap, envMapIntensity: 1.2,
  });
  const lowerPaint = paint.two ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(paint.two), metalness: 0.4, roughness: 0.35, clearcoat: 1, envMap }) : paintMat;

  // lower body with wheel arches (shape x = longitudinal, rear negative)
  const archs = [{ x: fz, cy: R, r: R + 0.06 }, { x: rz, cy: R, r: R + 0.06 }];
  const lowerShape = profileShape(prof.lower, len, hgt, archs);
  const lower = new THREE.Mesh(extrude(lowerShape, wid, 0.09, 4), paintMat);
  lower.position.y = 0.06 + (opts.lowered ?? 0);
  body.add(lower);
  if (paint.two) {
    // two-tone: lower half band
    const band = new THREE.Mesh(extrude(profileShape([[-0.5, 0.3], [-0.5, 0.42], [0.5, 0.40], [0.5, 0.3]], len * 1.002, hgt, archs), wid + 0.01, 0.09, 4), lowerPaint);
    band.position.y = lower.position.y; body.add(band);
  }

  // cabin / glasshouse
  const cabinPts = prof.cabin.map(([x, y]) => [x * len, y * hgt]);
  const cs = new THREE.Shape(); cs.moveTo(cabinPts[0][0], cabinPts[0][1] - 0.04);
  for (const p of cabinPts) cs.lineTo(p[0], p[1]);
  cs.lineTo(cabinPts[cabinPts.length - 1][0], cabinPts[cabinPts.length - 1][1] - 0.04); cs.closePath();
  const cabinW = wid * (b.style === 'roadster' ? 0.86 : 0.80);
  const cabin = new THREE.Mesh(extrude(cs, cabinW, 0.05, 2), glassMat());
  cabin.position.y = lower.position.y; body.add(cabin);
  if (b.style !== 'roadster') {
    // roof skin + pillars in body colour
    const roofPts = prof.cabin.slice(1, 3).map(([x, y]) => [x * len, y * hgt]);
    const rs = new THREE.Shape(); rs.moveTo(roofPts[0][0] - 0.06, roofPts[0][1] - 0.06); rs.lineTo(roofPts[0][0], roofPts[0][1] + 0.012); rs.lineTo(roofPts[1][0], roofPts[1][1] + 0.012); rs.lineTo(roofPts[1][0] + 0.06, roofPts[1][1] - 0.06); rs.closePath();
    const roof = new THREE.Mesh(extrude(rs, cabinW * 0.96, 0.04, 2), paintMat); roof.position.y = lower.position.y; body.add(roof);
  } else {
    // roll hoop + seats for the roadster
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 12, Math.PI), chromeMat());
    hoop.position.set(0, lower.position.y + 0.66 * hgt, -0.22 * len); body.add(hoop);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.8, 0.35, 0.5), blackMat()); seat.position.set(0, lower.position.y + 0.62 * hgt, -0.08 * len); body.add(seat);
  }

  // lights
  const frontZ = len / 2, rearZ = -len / 2;
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dd, emissiveIntensity: 2.2, roughness: 0.1, metalness: 0.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1010, emissiveIntensity: 0.9, roughness: 0.3 });
  const yH = lower.position.y + 0.47 * hgt;
  for (const sd of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.06), headMat);
    hl.position.set(sd * (wid / 2 - 0.26), yH, frontZ - 0.035 - 0.06); hl.rotation.x = -0.35; body.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.05), tailMat);
    tl.position.set(sd * (wid / 2 - 0.27), lower.position.y + 0.54 * hgt, rearZ + 0.02); body.add(tl);
  }
  // grille, bumpers, plates
  const grille = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.5, 0.11, 0.04), blackMat()); grille.position.set(0, lower.position.y + 0.36 * hgt, frontZ + 0.005); body.add(grille);
  const plateF = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.21), new THREE.MeshStandardMaterial({ map: TX.plateTexture(dress.number || 'RD 86-01') }));
  plateF.position.set(0, lower.position.y + 0.28 * hgt, frontZ + 0.03); body.add(plateF);
  const plateR = plateF.clone(); plateR.position.set(0, lower.position.y + 0.40 * hgt, rearZ - 0.03); plateR.rotation.y = Math.PI; body.add(plateR);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.9, 0.08, 0.2), blackMat()); diffuser.position.set(0, lower.position.y + 0.2 * hgt, rearZ + 0.08); body.add(diffuser);
  // mirrors
  for (const sd of [-1, 1]) {
    const mr = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.12), paintMat);
    mr.position.set(sd * (cabinW / 2 + 0.1), lower.position.y + 0.66 * hgt, (prof.cabin[prof.cabin.length - 1][0] * len) - 0.15); body.add(mr);
  }

  // aero parts
  if (aero !== 'stock') {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.96, 0.05, 0.22), new THREE.MeshStandardMaterial({ map: TX.carbonTexture(), roughness: 0.3, metalness: 0.4, envMap }));
    lip.position.set(0, lower.position.y + 0.16, frontZ - 0.02); body.add(lip);
    for (const sd of [-1, 1]) {
      const sk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, wb - R * 2.3), paintMat);
      sk.position.set(sd * (wid / 2 - 0.01), lower.position.y + 0.16, (fz + rz) / 2); body.add(sk);
    }
    if (aero === 'wide') {
      for (const z of [fz, rz]) for (const sd of [-1, 1]) {
        const fl = new THREE.Mesh(new THREE.TorusGeometry(R + 0.08, 0.06, 6, 16, Math.PI), paintMat);
        fl.rotation.y = Math.PI / 2; fl.position.set(sd * (wid / 2 - 0.02), lower.position.y + R - 0.06, z); body.add(fl);
      }
    }
  }
  // spoiler
  const sp = dress.spoiler || 'none';
  const deckY = lower.position.y + prof.lower[3][1] * hgt;
  const deckZ = rearZ + 0.22;
  if (sp === 'duck') {
    const dk = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.82, 0.06, 0.2), paintMat); dk.position.set(0, deckY + 0.03, deckZ); dk.rotation.x = -0.35; body.add(dk);
  } else if (sp === 'mid' || sp === 'gt') {
    const hgtW = sp === 'gt' ? 0.34 : 0.17;
    const wingW = sp === 'gt' ? wid * 0.98 : wid * 0.8;
    const wingMat = sp === 'gt' ? new THREE.MeshStandardMaterial({ map: TX.carbonTexture(), roughness: 0.25, metalness: 0.5, envMap }) : paintMat;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(wingW, 0.035, sp === 'gt' ? 0.32 : 0.24), wingMat);
    wing.position.set(0, deckY + hgtW, deckZ - 0.02); wing.rotation.x = 0.12; body.add(wing);
    for (const sd of [-1, 1]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.03, hgtW, 0.12), blackMat()); st.position.set(sd * wingW * 0.32, deckY + hgtW / 2, deckZ); body.add(st);
      if (sp === 'gt') { const ep = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.36), wingMat); ep.position.set(sd * wingW / 2, deckY + hgtW + 0.03, deckZ - 0.02); body.add(ep); }
    }
  }
  // muffler
  const mu = MUFFLERS.find(m => m.id === dress.muffler) || MUFFLERS[0];
  const tipR = mu.big ? 0.07 : 0.042;
  const tipXs = mu.tips === 1 ? [wid * 0.3] : mu.tips === 2 ? [-wid * 0.3, wid * 0.3] : [-wid * 0.34, -wid * 0.26, wid * 0.26, wid * 0.34];
  for (const x of tipXs) {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(tipR, tipR * 0.9, 0.16, 14, 1, true), chromeMat());
    tip.rotation.x = Math.PI / 2; tip.position.set(x, lower.position.y + 0.17, rearZ - 0.02); body.add(tip);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(tipR * 0.85, 12), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    inner.position.set(x, lower.position.y + 0.17, rearZ - 0.08); inner.rotation.y = Math.PI; body.add(inner);
  }
  // decals
  const decal = dress.decal || 'none';
  const lum = new THREE.Color(paint.hex).getHSL({}).l;
  const contrast = lum > 0.5 ? '#111111' : '#f4f4f4';
  if (decal === 'stripe') {
    const stripeMat = new THREE.MeshStandardMaterial({ color: contrast, roughness: 0.35, metalness: 0.3, polygonOffset: true, polygonOffsetFactor: -4 });
    for (const sd of [-1, 1]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, len * 0.98), stripeMat);
      st.position.set(sd * 0.14, lower.position.y + 0.635 * hgt, 0); body.add(st);
    }
  } else if (decal !== 'none') {
    const tex = decalTexture(decal, contrast, dress.number || '86');
    for (const sd of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(decal === 'side' ? len * 0.62 : 0.7, decal === 'side' ? 0.34 : 0.5), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false }));
      pl.position.set(sd * (wid / 2 + 0.006), lower.position.y + 0.43 * hgt, decal === 'side' ? -0.05 : 0.05);
      pl.rotation.y = sd * Math.PI / 2; if (sd < 0 && decal === 'side') pl.scale.x = -1;
      body.add(pl);
    }
  }
  // ride height
  const drop = (RIDE_HEIGHTS.find(h => h.id === (dress.height || 0)) || RIDE_HEIGHTS[0]).drop;
  // underbody shadow-catcher
  const under = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.95, 0.05, len * 0.92), blackMat()); under.position.y = lower.position.y + 0.14; body.add(under);

  // wheels
  const track = wid / 2 - TW / 2 - 0.02 + wide * 0.6;
  const wheels = [];
  for (const [z, sd, front] of [[fz, 1, true], [fz, -1, true], [rz, 1, false], [rz, -1, false]]) {
    const holder = new THREE.Group(); holder.position.set(sd * track, R, z);
    const steer = new THREE.Group(); holder.add(steer);
    const w = wheelMesh(wheelStyle, R, TW, wheelStyle.color);
    if (sd < 0) w.spin.rotation.y = Math.PI; // mirror rim face outward
    if (sd < 0) { w.disc.position.x *= -1; w.caliper.position.x *= -1; }
    steer.add(w.spin, w.disc, w.caliper);
    root.add(holder);
    wheels.push({ holder, steer, spin: w.spin, front, side: sd, baseY: R });
  }

  // blob shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(wid * 1.25, len * 1.15), new THREE.MeshBasicMaterial({ map: TX.glowTexture('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; shadow.renderOrder = 1; root.add(shadow);

  // headlight beams (real spotlights only for cars that ask for them)
  const lights = [];
  if (opts.headlights) {
    for (const sd of [-1, 1]) {
      const sl = new THREE.SpotLight(0xfff2dd, 60, 120, 0.42, 0.55, 1.4);
      sl.position.set(sd * (wid / 2 - 0.3), yH, frontZ);
      sl.target.position.set(sd * 1.2, 0, frontZ + 30);
      body.add(sl, sl.target); lights.push(sl);
    }
  }
  // headlight glow sprites (flares)
  const flareMat = new THREE.SpriteMaterial({ map: TX.glowTexture('rgba(255,255,250,1)', 'rgba(180,200,255,0)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const flares = [];
  for (const sd of [-1, 1]) { const f = new THREE.Sprite(flareMat); f.position.set(sd * (wid / 2 - 0.26), yH, frontZ + 0.05); f.scale.set(0.9, 0.9, 1); body.add(f); flares.push(f); }
  const tailFlareMat = new THREE.SpriteMaterial({ map: TX.glowTexture('rgba(255,60,40,1)', 'rgba(255,0,0,0)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 });
  const tailFlares = [];
  for (const sd of [-1, 1]) { const f = new THREE.Sprite(tailFlareMat); f.position.set(sd * (wid / 2 - 0.27), lower.position.y + 0.54 * hgt, rearZ - 0.05); f.scale.set(0.7, 0.5, 1); body.add(f); tailFlares.push(f); }

  body.position.y = -drop;
  root.traverse(o => { if (o.isMesh) { o.castShadow = false; } });

  const api = {
    root, body, wheels, lights, flares, paintMat,
    setBrake(v) { tailMat.emissiveIntensity = 0.9 + v * 3.5; tailFlareMat.opacity = 0.45 + v * 0.55; tailFlares.forEach(f => f.scale.set(0.7 + v * 0.8, 0.5 + v * 0.4, 1)); },
    setGhost(on) {
      root.traverse(o => { if (o.material && !o.isSprite) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.35; o.material.depthWrite = false; } });
      shadow.visible = false;
    },
    // pose the model from a vehicle state; surface = {y, pitch, roll} from the road
    pose(v, surf) {
      root.position.set(v.x, surf.y, v.z);
      root.rotation.set(0, 0, 0);
      root.rotation.order = 'YXZ';
      root.rotation.y = v.yaw; root.rotation.x = -surf.pitch; root.rotation.z = surf.roll;
      body.rotation.x = v.pitch; body.rotation.z = -v.roll;
      body.position.y = -drop - Math.abs(v.pitch) * 0.3;
      for (const w of wheels) {
        w.spin.rotation.x = v.wheelRot;
        if (w.front) w.steer.rotation.y = v.steer;
      }
    },
    showcase(t) { body.position.y = -drop; body.rotation.set(0, 0, 0); for (const w of wheels) { w.spin.rotation.x = 0; w.steer.rotation.y = w.front ? Math.sin(t * 0.5) * 0.25 : 0; } },
    dispose() { root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); },
  };
  return api;
}

function decalTexture(kind, color, num) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  if (kind === 'side') {
    const grd = g.createLinearGradient(0, 0, 512, 0); grd.addColorStop(0, 'rgba(255,60,0,0)'); grd.addColorStop(0.3, '#ff3c00'); grd.addColorStop(1, '#ffd000');
    g.fillStyle = grd; g.beginPath(); g.moveTo(0, 200);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, 200 - Math.abs(Math.sin(x * 0.04)) * 150 * (x / 512));
    g.lineTo(512, 256); g.lineTo(0, 256); g.fill();
  } else if (kind === 'number') {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(256, 128, 118, 0, 7); g.fill();
    g.lineWidth = 10; g.strokeStyle = '#111'; g.stroke();
    g.fillStyle = '#111'; g.font = 'italic 900 150px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num).slice(0, 2), 256, 136);
  } else if (kind === 'rd') {
    g.fillStyle = color; g.font = 'italic 900 92px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('REVOLUTION', 256, 100); g.font = 'italic 900 60px "Arial Black", Impact, sans-serif'; g.fillStyle = '#ff7a00'; g.fillText('DRIVE', 256, 180);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
