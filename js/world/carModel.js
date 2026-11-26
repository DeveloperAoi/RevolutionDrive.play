// REVOLUTION DRIVE — procedural 3D car models (original designs)
// Bodies are extruded from side profiles with real wheel-arch cut-outs, and every
// dress-up option (paint, wheels, spoiler, aero, muffler) changes the actual geometry.
import * as THREE from 'three';
import { MUFFLERS, RIDE_HEIGHTS } from '../data/cars.js';
import { WHEEL_DESIGNS, normalizeCar } from '../data/custom.js';
import * as TX from './textures.js';
import { createGlbCar, packReady } from './glbCar.js';

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
  // ---- per-model silhouettes (index 3 of `lower` = rear deck, cabin = [rear base, roof rear, roof front, front base]) ----
  retroHatch: { lower: [[-0.5, 0.30], [-0.5, 0.58], [-0.48, 0.64], [-0.30, 0.65], [0.30, 0.62], [0.47, 0.57], [0.5, 0.47], [0.5, 0.30]], cabin: [[-0.48, 0.63], [-0.43, 0.96], [0.06, 1.0], [0.28, 0.63]] },
  hotHatch: { lower: [[-0.5, 0.32], [-0.5, 0.60], [-0.47, 0.66], [-0.32, 0.67], [0.30, 0.60], [0.46, 0.50], [0.5, 0.42], [0.5, 0.30]], cabin: [[-0.46, 0.65], [-0.37, 0.98], [0.02, 1.0], [0.30, 0.60]] },
  curvyCoupe: { lower: [[-0.5, 0.33], [-0.5, 0.50], [-0.46, 0.60], [-0.30, 0.62], [-0.10, 0.58], [0.25, 0.52], [0.44, 0.42], [0.5, 0.36], [0.5, 0.30]], cabin: [[-0.33, 0.58], [-0.12, 0.93], [0.05, 0.95], [0.27, 0.53]] },
  gtCoupe: { lower: [[-0.5, 0.30], [-0.5, 0.58], [-0.48, 0.64], [-0.28, 0.65], [0.30, 0.60], [0.47, 0.54], [0.5, 0.44], [0.5, 0.30]], cabin: [[-0.33, 0.63], [-0.18, 0.97], [0.10, 0.99], [0.30, 0.60]] },
  rallySedan: { lower: [[-0.5, 0.30], [-0.5, 0.55], [-0.47, 0.62], [-0.28, 0.63], [0.30, 0.58], [0.46, 0.50], [0.5, 0.40], [0.5, 0.28]], cabin: [[-0.30, 0.62], [-0.18, 0.96], [0.10, 0.98], [0.30, 0.60]] },
  notchCoupe: { lower: [[-0.5, 0.30], [-0.5, 0.55], [-0.47, 0.62], [-0.33, 0.63], [0.32, 0.56], [0.47, 0.48], [0.5, 0.40], [0.5, 0.30]], cabin: [[-0.36, 0.62], [-0.20, 0.94], [0.08, 0.96], [0.32, 0.56]] },
  sleekCoupe: { lower: [[-0.5, 0.30], [-0.5, 0.56], [-0.46, 0.63], [-0.30, 0.64], [0.30, 0.57], [0.46, 0.47], [0.5, 0.39], [0.5, 0.30]], cabin: [[-0.34, 0.62], [-0.16, 0.95], [0.06, 0.97], [0.31, 0.56]] },
  wedgeCoupe: { lower: [[-0.5, 0.32], [-0.5, 0.55], [-0.45, 0.62], [-0.30, 0.62], [0.35, 0.53], [0.48, 0.44], [0.5, 0.38], [0.5, 0.30]], cabin: [[-0.38, 0.60], [-0.16, 0.92], [0.04, 0.94], [0.32, 0.54]] },
  compactGT: { lower: [[-0.5, 0.30], [-0.5, 0.57], [-0.47, 0.63], [-0.30, 0.64], [0.32, 0.60], [0.47, 0.53], [0.5, 0.44], [0.5, 0.30]], cabin: [[-0.33, 0.62], [-0.20, 0.95], [0.08, 0.97], [0.31, 0.59]] },
  angularGT: { lower: [[-0.5, 0.30], [-0.5, 0.60], [-0.49, 0.65], [-0.27, 0.66], [0.30, 0.61], [0.47, 0.55], [0.5, 0.45], [0.5, 0.30]], cabin: [[-0.30, 0.64], [-0.18, 0.98], [0.12, 1.0], [0.30, 0.61]] },
  longGT: { lower: [[-0.5, 0.32], [-0.5, 0.52], [-0.46, 0.60], [-0.30, 0.62], [-0.10, 0.60], [0.30, 0.54], [0.46, 0.45], [0.5, 0.38], [0.5, 0.30]], cabin: [[-0.32, 0.60], [-0.12, 0.93], [0.06, 0.95], [0.28, 0.55]] },
  modernCoupe: { lower: [[-0.5, 0.31], [-0.5, 0.55], [-0.46, 0.62], [-0.32, 0.63], [0.30, 0.57], [0.45, 0.47], [0.5, 0.40], [0.5, 0.30]], cabin: [[-0.34, 0.61], [-0.15, 0.95], [0.05, 0.97], [0.30, 0.56]] },
  luxSedan: { lower: [[-0.5, 0.31], [-0.5, 0.56], [-0.485, 0.635], [-0.36, 0.655], [0.25, 0.625], [0.465, 0.565], [0.5, 0.47], [0.5, 0.31]], cabin: [[-0.355, 0.645], [-0.215, 0.975], [0.075, 0.995], [0.255, 0.615]], doors: 4 },
  rallySedan2: { lower: [[-0.5, 0.30], [-0.5, 0.56], [-0.47, 0.62], [-0.28, 0.63], [0.30, 0.59], [0.46, 0.51], [0.5, 0.42], [0.5, 0.30]], cabin: [[-0.30, 0.62], [-0.17, 0.97], [0.12, 0.99], [0.30, 0.60]] },
};

let envMap = null;
export function setEnvMap(e) { envMap = e; }
export const getEnvMap = () => envMap;

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


// ---- paint materials -----------------------------------------------------------
export function paintMaterial(hex, finish = 'metallic') {
  const c = new THREE.Color(hex);
  const p = { color: c, envMap, envMapIntensity: 1.2 };
  if (finish === 'gloss') Object.assign(p, { metalness: 0.15, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.03 });
  else if (finish === 'metallic') Object.assign(p, { metalness: 0.7, roughness: 0.33, clearcoat: 1, clearcoatRoughness: 0.06 });
  else if (finish === 'pearl') Object.assign(p, { metalness: 0.35, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 0.85, iridescenceIOR: 1.6, sheen: 0.6, sheenColor: new THREE.Color(0xccddff) });
  else Object.assign(p, { metalness: 0.05, roughness: 0.85, clearcoat: 0, envMapIntensity: 0.3 }); // matte
  return new THREE.MeshPhysicalMaterial(p);
}

// ---- wheels -----------------------------------------------------------------------
export function wheelBuild(cfg, R, W, tireLook = 'normal') {
  const des = WHEEL_DESIGNS.find(d => d.id === cfg.design) || WHEEL_DESIGNS[0];
  const g = new THREE.Group();
  const inch = cfg.size || 16;
  const rimR = R * (0.52 + (inch - 15) * 0.065);
  const stretch = tireLook === 'stretch';
  const tireMat = new THREE.MeshStandardMaterial({ color: tireLook === 'slick' ? 0x1c1c1e : 0x141414, roughness: tireLook === 'slick' ? 0.45 : 0.9, side: THREE.DoubleSide });
  const tw = stretch ? W * 0.82 : W;
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(R, R, tw, 30, 1, true), tireMat); tire.rotation.z = Math.PI / 2; g.add(tire);
  // sidewalls as flat rings (profile depends on rim size)
  const wallGeo = new THREE.RingGeometry(rimR * 0.98, R, 30, 1);
  for (const sd of [-1, 1]) { const wall = new THREE.Mesh(wallGeo, tireMat); wall.rotation.y = Math.PI / 2; wall.position.x = sd * tw / 2; g.add(wall); }
  const bulge = new THREE.Mesh(new THREE.TorusGeometry((R + rimR) / 2, (R - rimR) * (stretch ? 0.32 : 0.45), 8, 30), tireMat);
  bulge.rotation.y = Math.PI / 2; bulge.position.x = tw * 0.32; bulge.scale.z = 0.5; g.add(bulge);
  if (tireLook === 'letter') {
    const lm = new THREE.MeshBasicMaterial({ color: 0xf0f0f0 });
    for (let i = 0; i < 2; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry((R + rimR) / 2, 0.012, 4, 20, Math.PI * 0.5), lm); a.rotation.y = Math.PI / 2; a.rotation.x = i * Math.PI + 0.4; a.position.x = tw * 0.5 + 0.004; g.add(a); }
  }
  const rimMat = new THREE.MeshStandardMaterial({ color: cfg.color || '#c9ccd0', metalness: 0.85, roughness: cfg.color === '#161616' ? 0.5 : 0.25, envMap });
  const lipMat = new THREE.MeshStandardMaterial({ color: cfg.rim || cfg.color || '#c9ccd0', metalness: 0.95, roughness: 0.15, envMap });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, tw * 0.9, 26, 1, true), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide, envMap }));
  barrel.rotation.z = Math.PI / 2; g.add(barrel);
  const back = new THREE.Mesh(new THREE.CircleGeometry(rimR, 20), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, side: THREE.DoubleSide })); back.rotation.y = Math.PI / 2; back.position.x = -tw * 0.15; g.add(back);
  const faceX = des.shape === 'dish' ? tw * 0.28 : tw * 0.36;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(rimR, des.shape === 'dish' ? 0.028 : 0.018, 6, 30), lipMat); lip.rotation.y = Math.PI / 2; lip.position.x = tw * 0.45; g.add(lip);
  if (des.shape === 'dish') { // deep lip barrel
    const dl = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR * 0.93, tw * 0.2, 26, 1, true), lipMat); dl.rotation.z = Math.PI / 2; dl.position.x = tw * 0.36; g.add(dl);
  }
  const face = new THREE.Group(); face.position.x = faceX;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.2, rimR * 0.22, 0.05, 12), rimMat); hub.rotation.z = Math.PI / 2; face.add(hub);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(rimR * 0.1, 12), new THREE.MeshBasicMaterial({ color: 0x111111 })); cap.rotation.y = Math.PI / 2; cap.position.x = 0.027; face.add(cap);
  const spoke = (ang, len = rimR * 0.82, wdt = des.w, tilt = 0, depth = 0) => {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, len, wdt), rimMat);
    sp.position.set(depth, rimR * 0.18 + len / 2, 0); sp.rotation.x = tilt;
    const piv = new THREE.Group(); piv.add(sp); piv.rotation.x = ang; face.add(piv);
  };
  const n = des.n;
  if (des.shape === 'spoke') for (let i = 0; i < n; i++) spoke(i / n * Math.PI * 2);
  else if (des.shape === 'twin') for (let i = 0; i < n; i++) { spoke(i / n * Math.PI * 2 - 0.09); spoke(i / n * Math.PI * 2 + 0.09); }
  else if (des.shape === 'mesh') for (let i = 0; i < n; i++) { spoke(i / n * Math.PI * 2, rimR * 0.85, des.w, 0.35, 0); spoke(i / n * Math.PI * 2, rimR * 0.85, des.w, -0.35, 0.006); }
  else if (des.shape === 'star') for (let i = 0; i < n; i++) { spoke(i / n * Math.PI * 2, rimR * 0.5, des.w * 1.3); spoke(i / n * Math.PI * 2 - 0.16, rimR * 0.82, des.w * 0.6, 0.2); spoke(i / n * Math.PI * 2 + 0.16, rimR * 0.82, des.w * 0.6, -0.2); }
  else if (des.shape === 'turbine') for (let i = 0; i < n; i++) spoke(i / n * Math.PI * 2, rimR * 0.82, des.w * 1.6, 0.5);
  else if (des.shape === 'dish') {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.92, rimR * 0.92, 0.02, 26), rimMat); disc.rotation.z = Math.PI / 2; face.add(disc);
    const holeM = new THREE.MeshBasicMaterial({ color: 0x050505 });
    for (let i = 0; i < n; i++) { const h = new THREE.Mesh(new THREE.CircleGeometry(rimR * 0.16, 10), holeM); const a = i / n * Math.PI * 2; h.position.set(0.012, Math.cos(a) * rimR * 0.6, Math.sin(a) * rimR * 0.6); h.rotation.y = Math.PI / 2; face.add(h); }
  }
  g.add(face);
  return { group: g, rimR };
}

// ---- vinyl textures -------------------------------------------------------------
const vinylCache = {};
function vinylTexture(kind, color, text) {
  const key = kind + color + text; if (vinylCache[key]) return vinylCache[key];
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 512); g.fillStyle = color; g.strokeStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (kind === 'flame') {
    const grd = g.createLinearGradient(0, 0, 1024, 0); grd.addColorStop(0, 'rgba(255,60,0,0)'); grd.addColorStop(0.3, '#ff3c00'); grd.addColorStop(1, '#ffd000');
    g.fillStyle = grd; g.beginPath(); g.moveTo(0, 420);
    for (let x = 0; x <= 1024; x += 40) g.lineTo(x, 420 - Math.abs(Math.sin(x * 0.02)) * 300 * (x / 1024));
    g.lineTo(1024, 512); g.lineTo(0, 512); g.fill();
  } else if (kind === 'lines') {
    for (let i = 0; i < 5; i++) { g.fillRect(80 + i * 60, 160 + i * 34, 900 - i * 120, 16); }
  } else if (kind === 'number') {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(512, 256, 220, 0, 7); g.fill(); g.lineWidth = 18; g.strokeStyle = '#111'; g.stroke();
    g.fillStyle = '#111'; g.font = 'italic 900 280px "Arial Black", Impact, sans-serif'; g.fillText(String(text || '86').slice(0, 2), 512, 270);
  } else if (kind === 'logo') {
    g.font = 'italic 900 170px "Arial Black", Impact, sans-serif'; g.fillText('REVOLUTION', 512, 200);
    g.fillStyle = '#ff7a00'; g.font = 'italic 900 110px "Arial Black", Impact, sans-serif'; g.fillText('DRIVE', 512, 350);
  } else if (kind === 'tribal') {
    g.lineWidth = 34; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(80 + k * 280, 420); g.bezierCurveTo(200 + k * 280, 60, 360 + k * 280, 460, 420 + k * 280, 120); g.stroke(); }
  } else if (kind === 'kanji') {
    g.font = '900 380px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif'; g.fillText('峠', 512, 270);
  } else if (kind === 'stripe') {
    g.fillRect(452, 0, 40, 512); g.fillRect(532, 0, 40, 512);
  } else if (kind === 'text') {
    g.font = 'italic 900 150px "Arial Black", Impact, sans-serif'; g.fillText(String(text || 'TEAM').slice(0, 10), 512, 256);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (vinylCache[key] = t);
}
const decalMat = (tex) => new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.35, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -6, depthWrite: false });

// ---- car ---------------------------------------------------------------------------
export function createCar(spec, dressIn = {}, opts = {}) {
  const dress = dressIn && dressIn.v2 ? dressIn : normalizeCar({ dress: dressIn || {} }).dress;
  if (spec.model && spec.model.pack && packReady(spec.model.pack)) { const g = createGlbCar(spec, dress, opts); if (g) return g; }
  const A = dress.aero || {};
  const b = spec.body;
  const len = b.len, hgt = b.hgt;
  const wide = A.fender === 2 ? 0.08 : A.fender === 1 ? 0.04 : 0;
  const wid = b.wid + (A.fender === 2 ? wide * 2 : 0);
  const prof = PROFILES[b.shape] || PROFILES[b.style] || PROFILES.coupe;
  const R = spec.tire.radius, TW = (spec.tire.width + ((dressIn && dressIn.wheel && dressIn.wheel.tireW) || 0)) / 1000 + 0.02;
  const wb = spec.wheelbase;
  const fz = wb / 2, rz = -wb / 2;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);

  const paintMat = paintMaterial(dress.color.hex, dress.color.finish);
  const lum = new THREE.Color(dress.color.hex).getHSL({}).l;
  const contrast = lum > 0.5 ? '#111111' : '#f4f4f4';
  const carbonMat = new THREE.MeshStandardMaterial({ map: TX.carbonTexture(), roughness: 0.25, metalness: 0.45, envMap });
  const bk = blackMat();

  const archs = [{ x: fz, cy: R, r: R + 0.06 }, { x: rz, cy: R, r: R + 0.06 }];
  const lower = new THREE.Mesh(extrude(profileShape(prof.lower, len, hgt, archs), wid, 0.09, 4), paintMat);
  lower.position.y = 0.06; body.add(lower);
  const Y0 = lower.position.y;
  const yAt = (xn) => { // body top height at normalised x along the lower profile
    const P = prof.lower; for (let i = 1; i < P.length; i++) if (xn <= P[i][0]) { const t = (xn - P[i - 1][0]) / ((P[i][0] - P[i - 1][0]) || 1); return Y0 + (P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t) * hgt; } return Y0 + P[P.length - 1][1] * hgt;
  };

  // cabin
  const cabinPts = prof.cabin.map(([x, y]) => [x * len, y * hgt]);
  const cs = new THREE.Shape(); cs.moveTo(cabinPts[0][0], cabinPts[0][1] - 0.04);
  for (const p of cabinPts) cs.lineTo(p[0], p[1]);
  cs.lineTo(cabinPts[cabinPts.length - 1][0], cabinPts[cabinPts.length - 1][1] - 0.04); cs.closePath();
  const cabinW = wid * (b.style === 'roadster' ? 0.86 : 0.80) - (A.fender === 2 ? wide * 2 : 0);
  const cabin = new THREE.Mesh(extrude(cs, cabinW, 0.05, 2), glassMat()); cabin.position.y = Y0; body.add(cabin);
  if (b.style !== 'roadster') {
    const rp = prof.cabin.slice(1, 3).map(([x, y]) => [x * len, y * hgt]);
    const rs = new THREE.Shape(); rs.moveTo(rp[0][0] - 0.06, rp[0][1] - 0.06); rs.lineTo(rp[0][0], rp[0][1] + 0.012); rs.lineTo(rp[1][0], rp[1][1] + 0.012); rs.lineTo(rp[1][0] + 0.06, rp[1][1] - 0.06); rs.closePath();
    const roof = new THREE.Mesh(extrude(rs, cabinW * 0.96, 0.04, 2), paintMat); roof.position.y = Y0; body.add(roof);
  } else {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 12, Math.PI), chromeMat()); hoop.position.set(0, Y0 + 0.66 * hgt, -0.22 * len); body.add(hoop);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.8, 0.35, 0.5), bk); seat.position.set(0, Y0 + 0.62 * hgt, -0.08 * len); body.add(seat);
  }

  // lights, grille, plates, mirrors
  const frontZ = len / 2 + 0.072, rearZ = -len / 2 - 0.072; // bevel grows the extruded outline by ~7cm
  const lit = !!(opts.headlights || opts.flares);
  const headMat = new THREE.MeshStandardMaterial({ color: lit ? 0xffffff : 0xd8dde4, emissive: 0xfff4dd, emissiveIntensity: lit ? 2.2 : 0.12, roughness: 0.08, metalness: lit ? 0 : 0.5, envMap });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1010, emissiveIntensity: 0.9, roughness: 0.3 });
  const yH = Math.min(Y0 + 0.47 * hgt, Y0 + prof.lower[prof.lower.length - 1][1] * hgt - 0.075);
  const headStyle = b.head || 'rect', tailStyle = b.tail || 'bar';
  const noseY = yAt(0.47), lightW = wid / 2 - 0.26;
  for (const sd of [-1, 1]) {
    // headlights
    if (headStyle === 'popup') {
      // retractable lamps: closed panels in the showroom, raised pods with lamps when driving at night
      const up = !!opts.headlights;
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.34, up ? 0.16 : 0.03, 0.26), paintMat);
      pod.position.set(sd * lightW, noseY + (up ? 0.08 : 0.01), frontZ - 0.32); pod.rotation.x = up ? 0 : -0.25; body.add(pod);
      if (up) { const lm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.11, 0.03), headMat); lm.position.set(sd * lightW, noseY + 0.09, frontZ - 0.18); body.add(lm); }
      const turn = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.04), new THREE.MeshStandardMaterial({ color: 0xffaa22, emissive: 0x552200, roughness: 0.3 }));
      turn.position.set(sd * (wid / 2 - 0.35), Y0 + 0.36 * hgt, frontZ + 0.01); body.add(turn);
    } else if (headStyle === 'round' || headStyle === 'oval') {
      for (const k of headStyle === 'round' ? [0, 1] : [0]) {
        const hl = new THREE.Mesh(new THREE.CylinderGeometry(headStyle === 'oval' ? 0.13 : 0.08, headStyle === 'oval' ? 0.13 : 0.08, 0.05, 18), headMat);
        hl.rotation.x = Math.PI / 2; hl.scale.set(headStyle === 'oval' ? 1.6 : 1, 1, 1); hl.position.set(sd * (lightW - k * 0.18), yH, frontZ - 0.015); body.add(hl);
      }
    } else {
      const dims = { quad: [0.44, 0.1], slim: [0.42, 0.06], lowslim: [0.36, 0.05], big: [0.40, 0.13], rect: [0.36, 0.10], angular: [0.42, 0.10], swept: [0.46, 0.07] }[headStyle] || [0.36, 0.09];
      if (headStyle === 'quad') {
        for (const k of [0, 1]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.085, 0.05), headMat); hl.position.set(sd * (lightW + (k ? -0.11 : 0.1)), yH, frontZ + 0.0); hl.rotation.x = -0.1; body.add(hl); }
      } else {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(dims[0], dims[1], 0.06), headMat);
        hl.position.set(sd * lightW, headStyle === 'lowslim' ? yH - 0.05 : yH, frontZ - 0.01); hl.rotation.x = -0.1;
        if (headStyle === 'swept' || headStyle === 'angular') hl.rotation.y = sd * 0.25;
        body.add(hl);
      }
    }
    // tail lights
    const ty = Y0 + 0.54 * hgt;
    if (tailStyle === 'round' || tailStyle === 'roundBig') {
      const r0 = tailStyle === 'roundBig' ? 0.12 : 0.075;
      for (const k of tailStyle === 'round' ? [0, 1] : [0]) {
        const tl = new THREE.Mesh(new THREE.CylinderGeometry(r0, r0, 0.05, 18), tailMat); tl.rotation.x = Math.PI / 2;
        tl.position.set(sd * (wid / 2 - 0.22 - k * 0.2), ty, rearZ + 0.02); body.add(tl);
      }
    } else if (tailStyle === 'garnish') {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.05), tailMat); tl.position.set(sd * (wid / 2 - 0.3), ty, rearZ + 0.02); body.add(tl);
      const amb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.052), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222, roughness: 0.1 })); amb.position.set(sd * (wid / 2 - 0.3), ty - 0.035, rearZ + 0.021); body.add(amb);
      if (sd > 0) { const gm = new THREE.Mesh(new THREE.BoxGeometry(wid - 1.12, 0.1, 0.045), new THREE.MeshStandardMaterial({ color: 0x3a0505, emissive: 0x220000, roughness: 0.15, metalness: 0.3 })); gm.position.set(0, ty, rearZ + 0.018); body.add(gm); }
    } else if (tailStyle === 'full') {
      if (sd > 0) { const tl = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.86, 0.11, 0.05), tailMat); tl.position.set(0, ty, rearZ + 0.02); body.add(tl); }
    } else {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.05), tailMat); tl.position.set(sd * (wid / 2 - 0.27), ty, rearZ + 0.02); body.add(tl);
    }
    const mr = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.12), paintMat); mr.position.set(sd * (cabinW / 2 + 0.1), Y0 + 0.66 * hgt, prof.cabin[prof.cabin.length - 1][0] * len - 0.15); body.add(mr);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.5, 0.11, 0.04), bk); grille.position.set(0, Y0 + 0.36 * hgt, frontZ + 0.005); body.add(grille);
  const plateTex = TX.plateTexture(dress.number || 'RD 86-01');
  const plateF = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.21), new THREE.MeshStandardMaterial({ map: plateTex })); plateF.position.set(0, Y0 + 0.28 * hgt, frontZ + 0.03); body.add(plateF);
  const plateR = plateF.clone(); plateR.position.set(0, Y0 + 0.40 * hgt, rearZ - 0.03); plateR.rotation.y = Math.PI; body.add(plateR);
  const under = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.95, 0.05, len * 0.92), bk); under.position.y = Y0 + 0.14; body.add(under);

  // ---- realism details: pillars, window frames, door seams, handles, trims, exhaust, contact shadow ----
  const seg = (z0, y0, z1, y1, x, w, d, mat) => { // a thin bar from (z0,y0) to (z1,y1) on the side plane x
    const L = Math.hypot(z1 - z0, y1 - y0); const m = new THREE.Mesh(new THREE.BoxGeometry(w, L, d), mat);
    m.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2); m.rotation.x = Math.atan2(z1 - z0, y1 - y0); body.add(m); return m;
  };
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.45, metalness: 0.2 });
  const seamMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const chrome = chromeMat();
  if (b.style !== 'roadster') {
    const C = prof.cabin.map(([x, y]) => [x * len, Y0 + y * hgt]);
    const xs = cabinW / 2 - 0.012;
    const four = prof.doors === 4 || b.style === 'sedan';
    const bz = four ? C[1][0] + (C[2][0] - C[1][0]) * 0.52 : C[1][0] + (C[2][0] - C[1][0]) * 0.18;
    for (const sd of [-1, 1]) {
      const x = sd * xs;
      seg(C[3][0], C[3][1], C[2][0], C[2][1] + 0.01, x, 0.035, 0.07, paintMat);          // A pillar
      seg(C[0][0] + 0.05, C[0][1], C[1][0] + 0.03, C[1][1] - 0.02, x, 0.035, four ? 0.13 : 0.17, paintMat); // C pillar (wide)
      seg(C[1][0], C[1][1] - 0.012, C[2][0], C[2][1] - 0.012, x, 0.03, 0.035, trimMat);   // upper window frame
      seg(C[0][0], C[0][1] + 0.012, C[3][0], C[3][1] + 0.012, x + sd * 0.004, 0.02, 0.022, four ? chrome : trimMat); // beltline moulding
      seg(bz, C[0][1], bz, C[1][1] + (C[2][1] - C[1][1]) * 0.5, x, 0.03, 0.075, trimMat);  // B pillar (black, sash style)
      if (four) seg(bz - 0.42, C[0][1] + 0.02, bz - 0.42, C[1][1] - 0.04, x, 0.025, 0.035, trimMat); // rear quarter divider
      // door seams on the body side
      const xw = sd * (wid / 2 + 0.002), yb = Y0 + 0.2 * hgt;
      const seams = four ? [C[3][0] - 0.05, bz, C[0][0] + 0.18] : [C[3][0] - 0.05, bz - 0.05];
      for (const z of seams) seg(z, yb, z + 0.04, C[0][1] - 0.02, xw, 0.004, 0.008, seamMat);
      seg(seams[0], yb, seams[seams.length - 1], yb, xw, 0.004, 0.008, seamMat);
      // door handles
      for (const z of four ? [bz - 0.12, seams[2] - 0.12] : [bz - 0.17]) {
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.15), four ? chrome : paintMat); h.position.set(sd * (wid / 2 + 0.008), C[0][1] - 0.09, z); body.add(h);
      }
      // side marker lamp on the front fender
      const mk = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.025, 0.07), new THREE.MeshStandardMaterial({ color: 0xff9a1a, emissive: 0x441800, roughness: 0.2 }));
      mk.position.set(sd * (wid / 2 + 0.004), Y0 + 0.45 * hgt, fz + R + 0.15); body.add(mk);
      // wiper arms
      if (sd > 0) for (const wx of [-0.18, 0.28]) seg(C[3][0] - 0.02, C[3][1] + 0.01, C[3][0] - 0.12, C[3][1] + 0.06, wx * cabinW, 0.015, 0.012, bk).rotation.y = 0.0;
    }
    // roof drip rails / antenna
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.4, 4), bk); ant.position.set(-cabinW * 0.35, C[1][1] + 0.18, C[1][0] + 0.05); ant.rotation.x = -0.4; body.add(ant);
  }
  // headlight reflector housings (chrome behind the lens) + clear lens look
  for (const sd of [-1, 1]) {
    if (headStyle === 'popup') continue;
    const hb = new THREE.Mesh(new THREE.BoxGeometry(headStyle === 'quad' ? 0.5 : 0.44, 0.13, 0.02), new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 1, roughness: 0.18, envMap }));
    hb.position.set(sd * lightW, yH, frontZ + 0.0); hb.rotation.x = -0.1; body.add(hb);
  }
  // lower intake + fog lamps
  const intake = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.56, 0.09, 0.04), new THREE.MeshStandardMaterial({ map: TX.meshTexture ? TX.meshTexture() : null, color: 0x151515, roughness: 0.7 }));
  intake.position.set(0, Y0 + 0.17 * hgt, frontZ + 0.0); body.add(intake);
  for (const sd of [-1, 1]) { const fl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.03), new THREE.MeshStandardMaterial({ color: 0xdfe6ee, emissive: 0x333333, roughness: 0.1, metalness: 0.4 })); fl.position.set(sd * (wid / 2 - 0.2), Y0 + 0.18 * hgt, frontZ - 0.01); body.add(fl); }
  // exhaust tips
  const exN = (spec.engine && spec.engine.cyl >= 6) || spec.engine?.type === 'ROTARY' ? 2 : 1;
  for (let k = 0; k < exN; k++) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 14, 1, true), chrome); ex.rotation.x = Math.PI / 2;
    ex.position.set(-(wid / 2 - 0.3) + k * 0.11, Y0 + 0.11, rearZ + 0.02); body.add(ex);
    const ink = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), bk); ink.position.set(ex.position.x, ex.position.y, rearZ - 0.05); ink.rotation.y = Math.PI; body.add(ink);
  }


  // ---- aero parts (each category independent) ----
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rzz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rzz); body.add(m); return m; };
  // front spoiler / bumper
  if (A.fspoiler === 1) add(new THREE.BoxGeometry(wid * 0.92, 0.07, 0.26), bk, 0, Y0 + 0.12, frontZ - 0.08);
  if (A.fspoiler === 2) { add(new THREE.BoxGeometry(wid * 0.98, 0.2, 0.3), paintMat, 0, Y0 + 0.2, frontZ - 0.1); for (const x of [-0.45, 0, 0.45]) add(new THREE.BoxGeometry(x ? 0.28 : 0.5, 0.1, 0.05), bk, x * wid / 1.6, Y0 + 0.2, frontZ + 0.055); }
  if (A.fspoiler === 3) add(new THREE.BoxGeometry(wid * 1.0, 0.025, 0.42), carbonMat, 0, Y0 + 0.08, frontZ - 0.02);
  if (A.flip === 1) add(new THREE.BoxGeometry(wid * 0.96, 0.05, 0.22), carbonMat, 0, Y0 + 0.15, frontZ - 0.02);
  if (A.flip === 2) add(new THREE.BoxGeometry(wid * 1.02, 0.06, 0.3), carbonMat, 0, Y0 + 0.13, frontZ);
  // side skirts
  if (A.side) for (const sd of [-1, 1]) {
    add(new THREE.BoxGeometry(A.side === 2 ? 0.1 : 0.06, A.side === 2 ? 0.14 : 0.1, wb - R * 2.3), paintMat, sd * (wid / 2 - 0.01 + (A.side === 2 ? 0.02 : 0)), Y0 + 0.15, 0);
    if (A.side === 2) add(new THREE.BoxGeometry(0.12, 0.025, wb - R * 2.3), carbonMat, sd * (wid / 2 + 0.02), Y0 + 0.08, 0);
  }
  // rear bumper
  if (A.rbumper === 1) add(new THREE.BoxGeometry(wid * 0.9, 0.08, 0.22), bk, 0, Y0 + 0.13, rearZ + 0.08);
  if (A.rbumper === 2) { add(new THREE.BoxGeometry(wid * 0.92, 0.04, 0.32), carbonMat, 0, Y0 + 0.1, rearZ + 0.06); for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.015, 0.12, 0.3), carbonMat, i * wid * 0.14, Y0 + 0.16, rearZ + 0.06); }
  else add(new THREE.BoxGeometry(wid * 0.9, 0.08, 0.2), bk, 0, Y0 + 0.2 * hgt, rearZ + 0.08);
  // rear spoiler (ducktail / roof)
  const deckY = Y0 + prof.lower[3][1] * hgt, deckZ = rearZ + 0.22;
  if (A.rspoiler === 1) add(new THREE.BoxGeometry(wid * 0.82, 0.06, 0.2), paintMat, 0, deckY + 0.03, deckZ, -0.35);
  if (A.rspoiler === 2 && b.style !== 'roadster') { const c1 = prof.cabin[1]; add(new THREE.BoxGeometry(cabinW * 0.9, 0.03, 0.22), paintMat, 0, Y0 + c1[1] * hgt + 0.01, c1[0] * len - 0.1, 0.15); }
  // wing
  if (A.wing) {
    const gt = A.wing >= 2, swan = A.wing === 3;
    const hW = gt ? 0.34 : 0.17, wW = gt ? wid * 0.98 : wid * 0.8;
    const wm = gt ? carbonMat : paintMat;
    add(new THREE.BoxGeometry(wW, 0.035, gt ? 0.32 : 0.24), wm, 0, deckY + hW, deckZ - 0.02, 0.12);
    for (const sd of [-1, 1]) {
      if (swan) { add(new THREE.BoxGeometry(0.025, hW + 0.08, 0.1), bk, sd * wW * 0.3, deckY + hW / 2 + 0.06, deckZ + 0.06, -0.25); }
      else add(new THREE.BoxGeometry(0.03, hW, 0.12), bk, sd * wW * 0.32, deckY + hW / 2, deckZ);
      if (gt) add(new THREE.BoxGeometry(0.02, 0.16, 0.36), wm, sd * wW / 2, deckY + hW + 0.03, deckZ - 0.02);
    }
  }
  // bonnet
  const hoodX0 = prof.cabin[prof.cabin.length - 1][0] + 0.03, hoodX1 = 0.45;
  const hz = ((hoodX0 + hoodX1) / 2) * len, hy = yAt((hoodX0 + hoodX1) / 2);
  const hoodSlope = Math.atan2(yAt(hoodX0) - yAt(hoodX1), (hoodX1 - hoodX0) * len);
  const hoodL = (hoodX1 - hoodX0) * len;
  if (A.bonnet === 1) add(new THREE.BoxGeometry(wid * 0.4, 0.06, hoodL * 0.8), paintMat, 0, hy + 0.02, hz, hoodSlope);
  if (A.bonnet === 2) add(new THREE.BoxGeometry(wid * 0.86, 0.012, hoodL * 0.95), carbonMat, 0, hy + 0.012, hz, hoodSlope);
  if (A.bonnet === 3) for (const sd of [-1, 1]) add(new THREE.BoxGeometry(wid * 0.18, 0.02, hoodL * 0.35), bk, sd * wid * 0.2, hy + 0.012, hz + 0.05, hoodSlope);
  // diffuser, intercooler, intake
  if (A.diffuser) { add(new THREE.BoxGeometry(wid * 0.8, 0.03, 0.34), carbonMat, 0, Y0 + 0.09, rearZ + 0.07, -0.12); for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.014, A.diffuser === 2 ? 0.16 : 0.1, 0.32), carbonMat, i * wid * 0.15, Y0 + 0.14, rearZ + 0.07); }
  if (A.intercooler) {
    const core = new THREE.Mesh(new THREE.BoxGeometry(wid * (A.intercooler === 2 ? 0.7 : 0.56), A.intercooler === 2 ? 0.16 : 0.12, 0.05), new THREE.MeshStandardMaterial({ map: TX.carbonTexture(), color: 0xb8bcc2, metalness: 0.9, roughness: 0.35, envMap }));
    core.position.set(0, Y0 + 0.24, frontZ - 0.04); body.add(core);
  }
  if (A.intake === 2) for (const sd of [-1, 1]) add(new THREE.BoxGeometry(0.16, 0.08, 0.05), bk, sd * wid * 0.32, Y0 + 0.22, frontZ + 0.012);
  if (A.intake === 1) add(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xd01010, roughness: 0.5 }), wid * 0.22, hy + 0.05, hz - 0.1, 0, 0, Math.PI / 2);
  // model features
  const feat = b.features || [];
  if (feat.includes('scoop') && !A.bonnet) { add(new THREE.BoxGeometry(wid * 0.26, 0.07, hoodL * 0.32), paintMat, 0, hy + 0.04, hz + 0.02, hoodSlope); add(new THREE.BoxGeometry(wid * 0.22, 0.05, 0.02), bk, 0, hy + 0.05, hz + hoodL * 0.16 + 0.01); }
  if (feat.includes('hoopwing') && !A.wing) { const ww = wid * 0.9; add(new THREE.BoxGeometry(ww, 0.03, 0.18), paintMat, 0, deckY + 0.2, deckZ + 0.02, 0.1); for (const sd of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.2, 0.14), paintMat, sd * ww / 2, deckY + 0.1, deckZ + 0.02); }
  if (feat.includes('wing') && !A.wing) { const ww = wid * 0.82; add(new THREE.BoxGeometry(ww, 0.03, 0.22), paintMat, 0, deckY + 0.16, deckZ, 0.14); for (const sd of [-1, 1]) add(new THREE.BoxGeometry(0.03, 0.16, 0.12), bk, sd * ww * 0.34, deckY + 0.08, deckZ); }
  // canards
  if (A.canard) for (const sd of [-1, 1]) for (let k = 0; k < A.canard; k++) add(new THREE.BoxGeometry(0.16, 0.012, 0.12), carbonMat, sd * (wid / 2 - 0.02), Y0 + 0.22 + k * 0.09, frontZ - 0.12, 0, 0, sd * 0.25);
  // over-fenders
  if (A.fender) for (const z of [fz, rz]) for (const sd of [-1, 1]) {
    const fl = add(new THREE.TorusGeometry(R + 0.08, A.fender === 2 ? 0.07 : 0.045, 6, 16, Math.PI), A.fender === 2 ? paintMat : bk, sd * (wid / 2 - 0.02 + (A.fender === 1 ? 0.03 : 0)), Y0 + R - 0.06, z, 0, Math.PI / 2);
  }
  // muffler
  const mu = MUFFLERS.find(m => m.id === dress.muffler) || MUFFLERS[0];
  const tipR = mu.big ? 0.07 : 0.042;
  const tipXs = mu.tips === 1 ? [wid * 0.3] : mu.tips === 2 ? [-wid * 0.3, wid * 0.3] : [-wid * 0.34, -wid * 0.26, wid * 0.26, wid * 0.34];
  for (const x of tipXs) {
    add(new THREE.CylinderGeometry(tipR, tipR * 0.9, 0.16, 14, 1, true), chromeMat(), x, Y0 + 0.17, rearZ - 0.02, Math.PI / 2);
    add(new THREE.CircleGeometry(tipR * 0.85, 12), new THREE.MeshBasicMaterial({ color: 0x050505 }), x, Y0 + 0.17, rearZ - 0.08, 0, Math.PI);
  }

  // ---- vinyls (position x,y −1..1, scale s, rotation r in degrees) ----
  const V = dress.vinyl || {};
  const vcolor = (v) => v.c || contrast;
  if (V.stripe && V.stripe.d !== 'none') {
    const sm = new THREE.MeshStandardMaterial({ color: vcolor(V.stripe), roughness: 0.35, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -4 });
    const widths = { twin: [[-0.14, 0.16], [0.14, 0.16]], single: [[0, 0.36]], offset: [[0.22 * (wid / 1.7), 0.22]] }[V.stripe.d] || [];
    for (const [x, w] of widths) {
      const xx = x + V.stripe.x * 0.3;
      // stripe follows hood → roof → deck roughly with three segments
      add(new THREE.BoxGeometry(w * V.stripe.s, 0.01, hoodL), sm, xx, hy + 0.008, hz, hoodSlope);
      if (b.style !== 'roadster') { const c1 = prof.cabin[1], c2 = prof.cabin[2]; add(new THREE.BoxGeometry(w * V.stripe.s * 0.9, 0.01, (c2[0] - c1[0]) * len), sm, xx, Y0 + (c1[1] + c2[1]) / 2 * hgt + 0.016, (c1[0] + c2[0]) / 2 * len); }
      add(new THREE.BoxGeometry(w * V.stripe.s, 0.01, 0.5), sm, xx, deckY + 0.008, rearZ + 0.3);
    }
  }
  if (V.side && V.side.d !== 'none') {
    const tex = vinylTexture(V.side.d, vcolor(V.side), dress.number || '86');
    const w0 = V.side.d === 'flame' || V.side.d === 'lines' ? len * 0.62 : 0.9, h0 = w0 / 2;
    for (const sd of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w0, h0), decalMat(tex));
      pl.position.set(sd * (wid / 2 + 0.006), Y0 + 0.4 * hgt + V.side.y * 0.15, V.side.x * len * 0.25);
      pl.rotation.set(0, sd * Math.PI / 2, 0); pl.rotateZ(V.side.r * Math.PI / 180);
      pl.scale.set(V.side.s * (sd < 0 && (V.side.d === 'flame' || V.side.d === 'lines') ? -1 : 1), V.side.s, 1);
      body.add(pl);
    }
  }
  if (V.hood && V.hood.d !== 'none') {
    const tex = vinylTexture(V.hood.d, vcolor(V.hood), dress.number);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(wid * 0.7, wid * 0.35), decalMat(tex));
    pl.position.set(V.hood.x * wid * 0.25, hy + 0.02, hz + V.hood.y * hoodL * 0.3);
    pl.rotation.set(-Math.PI / 2 + hoodSlope, 0, 0); pl.rotateZ(Math.PI + V.hood.r * Math.PI / 180); pl.scale.setScalar(V.hood.s);
    body.add(pl);
  }
  if (V.rear && V.rear.d !== 'none') {
    const tex = vinylTexture(V.rear.d, vcolor(V.rear), opts.teamName || dress.team || 'TEAM');
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(wid * 0.6, wid * 0.3), decalMat(tex));
    pl.position.set(V.rear.x * wid * 0.25, Y0 + 0.47 * hgt + V.rear.y * 0.08, rearZ - 0.006);
    pl.rotation.set(0, Math.PI, 0); pl.rotateZ(V.rear.r * Math.PI / 180); pl.scale.setScalar(V.rear.s * 0.8);
    body.add(pl);
  }

  // ---- wheels (front / rear configured separately) ----
  const W2 = dress.wheel || {};
  const wheels = [];
  for (const [z, sd, front] of [[fz, 1, true], [fz, -1, true], [rz, 1, false], [rz, -1, false]]) {
    const cfg = (front ? W2.f : W2.r) || { design: 'stock5', color: '#c9ccd0', size: 16, offset: 0 };
    const trk = wid / 2 - TW / 2 - 0.02 + wide * 0.6 + (cfg.offset || 0) * 0.012;
    const holder = new THREE.Group(); holder.position.set(sd * trk, R, z);
    const steer = new THREE.Group(); holder.add(steer);
    const w = wheelBuild(cfg, R, TW, W2.tire);
    if (sd < 0) w.group.rotation.y = Math.PI;
    steer.add(w.group);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(w.rimR * 0.82, w.rimR * 0.82, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.9, roughness: 0.35 }));
    disc.rotation.z = Math.PI / 2; disc.position.x = sd * TW * 0.12; steer.add(disc);
    const cal = A.calipers || 0;
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, [0.14, 0.18, 0.24][cal], [0.1, 0.13, 0.17][cal]), new THREE.MeshStandardMaterial({ color: [0x555555, 0xd01010, 0xd4a017][cal], roughness: 0.35, metalness: cal ? 0.3 : 0.6 }));
    caliper.position.set(sd * TW * 0.18, w.rimR * 0.55, -0.05); steer.add(caliper);
    root.add(holder);
    wheels.push({ holder, steer, spin: w.group, front, side: sd, baseY: R });
  }

  // blob shadow, lights, flares
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(wid * 1.25, len * 1.15), new THREE.MeshBasicMaterial({ map: TX.glowTexture('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; shadow.renderOrder = 1; root.add(shadow);
  const lights = [];
  if (opts.headlights) for (const sd of [-1, 1]) {
    const sl = new THREE.SpotLight(0xfff2dd, 320, 110, 0.5, 0.5, 1.25);
    sl.position.set(sd * (wid / 2 - 0.3), yH, frontZ); sl.target.position.set(sd * 1.0, -0.6, frontZ + 20);
    body.add(sl, sl.target); lights.push(sl);
  }
  const flareMat = new THREE.SpriteMaterial({ map: TX.glowTexture('rgba(255,255,250,1)', 'rgba(180,200,255,0)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  for (const sd of [-1, 1]) { const f = new THREE.Sprite(flareMat); f.position.set(sd * lightW, yH, frontZ + 0.05); f.scale.set(0.6, 0.6, 1); f.visible = !!(opts.headlights || opts.flares); body.add(f); }
  const tailFlareMat = new THREE.SpriteMaterial({ map: TX.glowTexture('rgba(255,60,40,1)', 'rgba(255,0,0,0)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: opts.headlights || opts.flares ? 0.6 : 0.15 });
  const tailFlares = [];
  for (const sd of [-1, 1]) { const f = new THREE.Sprite(tailFlareMat); f.position.set(sd * (wid / 2 - 0.27), Y0 + 0.54 * hgt, rearZ - 0.05); f.scale.set(0.7, 0.5, 1); body.add(f); tailFlares.push(f); }

  const drop = (RIDE_HEIGHTS.find(h => h.id === (dress.height || 0)) || RIDE_HEIGHTS[0]).drop;
  body.position.y = -drop;

  return {
    root, body, wheels, lights, paintMat, dims: { len, wid, hgt, R, fz, rz },
    setBrake(v) { tailMat.emissiveIntensity = 0.9 + v * 3.5; tailFlareMat.opacity = 0.45 + v * 0.55; tailFlares.forEach(f => f.scale.set(0.7 + v * 0.8, 0.5 + v * 0.4, 1)); },
    setGhost() {
      root.traverse(o => { if (o.material && !o.isSprite) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.35; o.material.depthWrite = false; } });
      shadow.visible = false;
    },
    pose(v, surf) {
      root.position.set(v.x, surf.y, v.z);
      root.rotation.order = 'YXZ';
      root.rotation.set(-surf.pitch, v.yaw, surf.roll);
      body.rotation.x = v.pitch; body.rotation.z = v.roll; // ay>0 (turning left) → right side dips (leans outward)
      body.position.y = -drop - Math.abs(v.pitch) * 0.3;
      for (const w of wheels) { w.spin.rotation.x = w.front ? (v.wheelRotF ?? v.wheelRot) : (v.wheelRotR ?? v.wheelRot); if (w.front) w.steer.rotation.y = v.steer; }
    },
    showcase(t, spinWheels = false) { body.position.y = -drop; body.rotation.set(0, 0, 0); for (const w of wheels) { w.spin.rotation.x = spinWheels ? t * 6 : 0; w.steer.rotation.y = w.front ? Math.sin(t * 0.5) * 0.25 : 0; } },
    dispose() { root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); },
  };
}
