// REVOLUTION DRIVE — original course definitions
// Courses are described as a chain of road segments ("turtle" layout):
//   l: length (m)  a: total heading change over segment (deg, + = left)  g: grade (dy/ds)
// optional flags: tunnel, lamps, sign (chevrons on the outside), w (road width override)
// The generator in world/track.js turns these into a smooth 3D ribbon with
// clothoid-like transitions, banking, guardrails, scenery and checkpoints.

export const COURSES = [
  {
    id: 'akane', name: 'AKANE PASS', jp: '赤嶺峠', sub: 'DOWNHILL',
    desc: '連続ヘアピンが牙を剥く夜の下り。トンネルを抜けた先が勝負所。',
    time: 'night', weather: 'clear', closed: false, laps: 1, width: 8.4, startY: 320,
    difficulty: 3, terrain: 'forest', mountainSide: 1, category: 'TOUGE',
    dirs: { fwd: ['DOWNHILL', '下り'], rev: ['UPHILL', '上り'] }, unlock: null,
    features: ['連続ヘアピン×5', 'ロングトンネル', '夜間照明区間'],
    segs: [
      { l: 150, a: 0, g: -0.02, lamps: true },
      { l: 130, a: -38, g: -0.05 },
      { l: 80, a: 0, g: -0.06 },
      { l: 100, a: 62, g: -0.06 },
      { l: 70, a: -58, g: -0.06 },
      { l: 160, a: -4, g: -0.07, lamps: true },
      { l: 52, a: -172, g: -0.07, sign: true },
      { l: 120, a: 0, g: -0.07 },
      { l: 52, a: 176, g: -0.07, sign: true },
      { l: 140, a: 12, g: -0.06 },
      { l: 70, a: -72, g: -0.05 },
      { l: 60, a: 74, g: -0.05 },
      { l: 60, a: -58, g: -0.05 },
      { l: 230, a: -18, g: -0.04, tunnel: true },
      { l: 110, a: 92, g: -0.05 },
      { l: 100, a: 0, g: -0.06 },
      { l: 50, a: -164, g: -0.07, sign: true },
      { l: 100, a: 0, g: -0.07, lamps: true },
      { l: 50, a: 168, g: -0.07, sign: true },
      { l: 90, a: 0, g: -0.06 },
      { l: 52, a: -168, g: -0.07, sign: true },
      { l: 160, a: 22, g: -0.05 },
      { l: 130, a: -46, g: -0.04 },
      { l: 110, a: 52, g: -0.03, lamps: true },
      { l: 200, a: 0, g: -0.02, lamps: true },
    ],
  },
  {
    id: 'shiranami', name: 'SHIRANAMI SKYLINE', jp: '白波スカイライン', sub: 'UPHILL',
    desc: '海を見下ろす夕暮れの尾根道。高速コーナーの連続で度胸が試される。',
    time: 'dusk', weather: 'clear', closed: false, laps: 1, width: 9.6, startY: 60,
    difficulty: 2, terrain: 'ridge', mountainSide: -1, category: 'SKYLINE',
    dirs: { fwd: ['UPHILL', '上り'], rev: ['DOWNHILL', '下り'] }, unlock: null,
    features: ['高速コーナー', '海沿いの尾根道', '夕暮れ'],
    segs: [
      { l: 180, a: 0, g: 0.02 },
      { l: 220, a: 40, g: 0.04 },
      { l: 120, a: 0, g: 0.05 },
      { l: 200, a: -55, g: 0.05 },
      { l: 160, a: 30, g: 0.05 },
      { l: 90, a: -95, g: 0.06, sign: true },
      { l: 220, a: 0, g: 0.05, lamps: true },
      { l: 240, a: 70, g: 0.04 },
      { l: 120, a: -35, g: 0.03 },
      { l: 130, a: 35, g: 0.03 },
      { l: 180, a: 0, g: 0.02, tunnel: true },
      { l: 60, a: -120, g: 0.05, sign: true },
      { l: 200, a: 20, g: 0.04 },
      { l: 220, a: -60, g: 0.04 },
      { l: 180, a: 45, g: 0.03 },
      { l: 260, a: 0, g: 0.01, lamps: true },
    ],
  },
  {
    id: 'ryusei', name: 'RYUSEI CIRCUIT', jp: '流星サーキット', sub: 'MOUNTAIN LOOP',
    desc: '山頂を一周する周回路。2周のスプリントで総合力が問われる。',
    time: 'night', weather: 'rain', closed: true, laps: 2, width: 9.0, startY: 180,
    difficulty: 2, terrain: 'forest', mountainSide: 1, category: 'CIRCUIT',
    dirs: { fwd: ['CLOCKWISE', '右回り'], rev: ['COUNTER', '左回り'] }, unlock: { rp: 300, text: 'ランク G2 以上で解放' },
    features: ['2周の周回路', '雨天ウェット', 'トンネル'],
    segs: [
      { l: 220, a: 0, g: 0, lamps: true },
      { l: 90, a: 95, g: 0.03, sign: true },
      { l: 160, a: 0, g: 0.04 },
      { l: 120, a: -60, g: 0.03 },
      { l: 110, a: 75, g: 0.02 },
      { l: 60, a: 110, g: 0.0, sign: true },
      { l: 180, a: 0, g: -0.02, tunnel: true },
      { l: 90, a: -50, g: -0.03 },
      { l: 120, a: 70, g: -0.03 },
      { l: 120, a: 0, g: -0.02, lamps: true },
      { l: 70, a: 120, g: -0.01, sign: true },
      { l: 120, a: -20, g: 0 },
    ],
  },
];

// Course categories prepared for future content: TOUGE, MOUNTAIN, CITY, NIGHT, RAIN, SNOW
export const courseById = (id) => COURSES.find(c => c.id === id) || COURSES[0];

export const TIMES = {
  night: { sky: [0x02040b, 0x0a1430, 0x1a2a55], fog: 0x070b18, fogNear: 40, fogFar: 420, amb: 0.18, moon: 0.35, lamps: true },
  dusk:  { sky: [0x1a1030, 0x7a3a50, 0xff8a3c], fog: 0x6a4058, fogNear: 80, fogFar: 900, amb: 0.55, moon: 1.2, lamps: true },
  day:   { sky: [0x2a6bd1, 0x7fb3ef, 0xdfeeff], fog: 0xb8cde0, fogNear: 120, fogFar: 1400, amb: 0.9, moon: 2.2, lamps: false },
};
