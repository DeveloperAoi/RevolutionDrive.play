// REVOLUTION DRIVE — vehicle catalogue
// All manufacturers, model names and designs are ORIGINAL to this game.
// No real-world brand, badge or body design is reproduced.

export const MAKERS = {
  KAZEMOTO: { name: 'KAZEMOTO', jp: '風本自動車', color: '#ff3b3b' },
  RYUJIN:   { name: 'RYUJIN',   jp: '龍神モータース', color: '#ffb300' },
  SORAWORKS:{ name: 'SORA WORKS', jp: 'ソラワークス', color: '#3bb3ff' },
  TSUBAME:  { name: 'TSUBAME',  jp: 'ツバメ工業', color: '#7dff5a' },
  KUROGANE: { name: 'KUROGANE', jp: '鉄重工', color: '#c0c0c0' },
};

// torque curve: [rpm, fraction of peak torque]
// engine.type drives the procedural engine sound (see audio/engine.js)
export const CARS = [
  {
    id: 'kaze_rs', disp: 1587, category: 'LIGHTWEIGHT', catJp: 'ライトウェイト', maker: 'KAZEMOTO', name: 'KAZE RS', jp: 'カゼ RS', year: 1986, price: 0,
    desc: '軽さが武器の小型FRクーペ。非力だが、峠では誰よりも素直に曲がる。',
    drive: 'FR', mass: 950, wheelbase: 2.40, cgHeight: 0.48, weightFront: 0.53,
    body: { len: 4.20, wid: 1.63, hgt: 1.33, style: 'hatch' },
    engine: { type: 'NA4', cyl: 4, hp: 130, torque: 149, idle: 900, redline: 7600, limiter: 7800,
      curve: [[800, .55], [3000, .80], [5200, 1.0], [6600, .96], [7800, .78]], inertia: 1.0 },
    gears: [3.59, 2.02, 1.38, 1.00, 0.86], final: 4.30, reverse: 3.48,
    tire: { grip: 1.00, radius: 0.29, width: 185 }, brake: 1.00, steerLock: 0.62, downforce: 0.0,
    sound: { pitch: 1.0, rasp: 0.6, turbo: false },
  },
  {
    id: 'tsubame_f', disp: 1797, category: 'TECHNICAL', catJp: 'テクニカル', maker: 'TSUBAME', name: 'TSUBAME TYPE-F', jp: 'ツバメ タイプF', year: 1998, price: 18000,
    desc: '高回転VTEC風NAを積むFFホットハッチ。立ち上がりの鋭さは本物。',
    drive: 'FF', mass: 1080, wheelbase: 2.62, cgHeight: 0.50, weightFront: 0.62,
    body: { len: 4.18, wid: 1.70, hgt: 1.36, style: 'hatch' },
    engine: { type: 'NA4HR', cyl: 4, hp: 200, torque: 196, idle: 1000, redline: 8600, limiter: 8800,
      curve: [[1000, .55], [4000, .78], [5800, .86], [7400, 1.0], [8800, .86]], inertia: 0.85 },
    gears: [3.23, 2.10, 1.46, 1.11, 0.88, 0.73], final: 4.40, reverse: 3.0,
    tire: { grip: 1.04, radius: 0.30, width: 205 }, brake: 1.08, steerLock: 0.60, downforce: 0.10,
    sound: { pitch: 1.15, rasp: 0.8, turbo: false },
  },
  {
    id: 'kurogane_s2', disp: 1997, category: 'BALANCE', catJp: 'バランス', maker: 'KUROGANE', name: 'KUROGANE S-II', jp: 'クロガネ S-II', year: 1999, price: 26000,
    desc: '50:50の前後重量配分を持つ2シーターFRロードスター。ドリフトの教科書。',
    drive: 'FR', mass: 1150, wheelbase: 2.40, cgHeight: 0.46, weightFront: 0.50,
    body: { len: 4.14, wid: 1.75, hgt: 1.28, style: 'roadster' },
    engine: { type: 'NA4HR', cyl: 4, hp: 250, torque: 218, idle: 900, redline: 8800, limiter: 9000,
      curve: [[900, .55], [4000, .80], [6800, 1.0], [8000, .95], [9000, .82]], inertia: 0.9 },
    gears: [3.13, 2.05, 1.48, 1.16, 0.97, 0.81], final: 4.10, reverse: 2.86,
    tire: { grip: 1.06, radius: 0.31, width: 225 }, brake: 1.12, steerLock: 0.64, downforce: 0.15,
    sound: { pitch: 1.1, rasp: 0.7, turbo: false },
  },
  {
    id: 'ryujin_r7', disp: 1308, category: 'ROTARY', catJp: 'ロータリー', maker: 'RYUJIN', name: 'RYUJIN R-7', jp: 'リュウジン R-7', year: 1992, price: 32000,
    desc: 'ツインローター・シーケンシャルツインターボ。甲高いロータリーサウンドで峠を切り裂くFR。',
    drive: 'FR', mass: 1260, wheelbase: 2.43, cgHeight: 0.46, weightFront: 0.51,
    body: { len: 4.29, wid: 1.76, hgt: 1.23, style: 'coupe' },
    engine: { type: 'ROTARY', cyl: 2, hp: 280, torque: 294, idle: 1000, redline: 8000, limiter: 8200,
      curve: [[1000, .45], [3000, .78], [5000, 1.0], [6500, .95], [8200, .80]], inertia: 0.75 },
    gears: [3.48, 2.02, 1.39, 1.00, 0.72], final: 4.10, reverse: 3.29,
    tire: { grip: 1.07, radius: 0.31, width: 235 }, brake: 1.12, steerLock: 0.62, downforce: 0.20,
    sound: { pitch: 1.0, rasp: 1.0, turbo: true },
  },
  {
    id: 'sora_gt4', disp: 2568, category: 'POWER', catJp: 'パワー', maker: 'SORAWORKS', name: 'SORA GT-4', jp: 'ソラ GT-4', year: 1999, price: 42000,
    desc: '直6ツインターボと電子制御4WD。圧倒的なトラクションで全てをねじ伏せる。',
    drive: '4WD', split: 0.35, mass: 1540, wheelbase: 2.67, cgHeight: 0.50, weightFront: 0.56,
    body: { len: 4.60, wid: 1.79, hgt: 1.36, style: 'coupe' },
    engine: { type: 'TURBO6', cyl: 6, hp: 330, torque: 392, idle: 900, redline: 7800, limiter: 8000,
      curve: [[900, .40], [2500, .70], [4400, 1.0], [6000, .97], [8000, .78]], inertia: 1.1 },
    gears: [3.83, 2.36, 1.69, 1.31, 1.00, 0.79], final: 3.55, reverse: 3.29,
    tire: { grip: 1.08, radius: 0.32, width: 245 }, brake: 1.15, steerLock: 0.58, downforce: 0.25,
    sound: { pitch: 0.9, rasp: 0.7, turbo: true },
  },
  {
    id: 'kazemoto_ev9', disp: 1997, category: 'TRACTION', catJp: 'トラクション', maker: 'KAZEMOTO', name: 'KAZE RALLY EV-9', jp: 'カゼ ラリー EV-9', year: 2005, price: 38000,
    desc: 'WRC直系のターボ4WDセダン。どんな路面でも牙を剥く。',
    drive: '4WD', split: 0.45, mass: 1400, wheelbase: 2.62, cgHeight: 0.52, weightFront: 0.58,
    body: { len: 4.49, wid: 1.77, hgt: 1.45, style: 'sedan' },
    engine: { type: 'TURBO4', cyl: 4, hp: 300, torque: 400, idle: 900, redline: 7200, limiter: 7500,
      curve: [[900, .40], [2800, .85], [3600, 1.0], [5500, .92], [7500, .70]], inertia: 1.0 },
    gears: [2.86, 1.92, 1.36, 1.05, 0.83, 0.66], final: 4.53, reverse: 3.0,
    tire: { grip: 1.06, radius: 0.32, width: 235 }, brake: 1.12, steerLock: 0.60, downforce: 0.20,
    sound: { pitch: 0.95, rasp: 0.85, turbo: true },
  },
];

export const carById = (id) => CARS.find(c => c.id === id) || CARS[0];

// ---- tuning --------------------------------------------------------------
// Each stage multiplies / offsets the base spec. Levels 0..3 (STOCK..STAGE3)
export const TUNE_PARTS = {
  engine:     { label: 'ENGINE',     jp: 'エンジン',       cost: [0, 4000, 9000, 16000] },
  turbo:      { label: 'INTAKE',     jp: '吸排気',         cost: [0, 3000, 7000, 12000] },
  weight:     { label: 'WEIGHT',     jp: '軽量化',         cost: [0, 3500, 8000, 14000] },
  tires:      { label: 'TIRES',      jp: 'タイヤ',         cost: [0, 2500, 6000, 11000] },
  suspension: { label: 'SUSPENSION', jp: 'サスペンション', cost: [0, 3000, 7000, 12000] },
  brakes:     { label: 'BRAKES',     jp: 'ブレーキ',       cost: [0, 2000, 5000, 9000] },
  gearbox:    { label: 'TRANSMISSION', jp: 'ミッション',   cost: [0, 3000, 6500, 11000] },
};

// produce effective spec from base + tune levels + setup sliders
export function buildSpec(base, tune = {}, setup = {}) {
  const t = (k) => tune[k] || 0;
  const s = JSON.parse(JSON.stringify(base));
  const powerMul = 1 + t('engine') * 0.09 + t('turbo') * (base.sound.turbo ? 0.08 : 0.05);
  s.engine.hp = Math.round(base.engine.hp * powerMul);
  s.engine.torque = Math.round(base.engine.torque * powerMul);
  s.engine.redline += t('engine') * 150; s.engine.limiter += t('engine') * 150;
  s.mass = Math.round(base.mass * (1 - t('weight') * 0.045));
  s.tire.grip = base.tire.grip * (1 + t('tires') * 0.045);
  s.brake = base.brake * (1 + t('brakes') * 0.08);
  s.suspensionLevel = t('suspension');
  s.gears = base.gears.map(g => g * (1 + t('gearbox') * 0.02)); // closer/shorter ratios
  s.shiftTime = 0.22 - t('gearbox') * 0.04;
  // setup sliders (-1..1)
  s.setup = {
    brakeBias: 0.62 + (setup.brakeBias || 0) * 0.08,
    steerSens: 1 + (setup.steer || 0) * 0.15,
    finalMul: 1 + (setup.final || 0) * 0.08,
    camber: (setup.camber || 0),        // + more drift-friendly rear
    stiffness: (setup.stiffness || 0),  // + stiffer
  };
  s.final = base.final * s.setup.finalMul;
  return s;
}

// display stats (0..10) for selection screens
export function carStats(spec) {
  const pw = spec.engine.hp / spec.mass * 1000; // hp per tonne
  const top = topSpeedKmh(spec);
  return {
    power: Math.min(10, pw / 26),
    speed: Math.min(10, (top - 150) / 14),
    handling: Math.min(10, (spec.tire.grip * 7) + (1400 - spec.mass) / 300 + (spec.drive === 'FR' ? 0.6 : 0) + (spec.suspensionLevel || 0) * .3),
    accel: Math.min(10, pw / 24 + (spec.drive === '4WD' ? 1.4 : 0)),
    brake: Math.min(10, spec.brake * 7.5 + (1400 - spec.mass) / 400),
    top,
  };
}

export function topSpeedKmh(spec) {
  // limited by gearing at limiter and by drag/power balance
  const g = spec.gears[spec.gears.length - 1] * spec.final;
  const gearTop = spec.engine.limiter / g * 2 * Math.PI * spec.tire.radius / 60 * 3.6;
  const P = spec.engine.hp * 745.7 * 0.85;
  const cda = 0.5 * 1.225 * 0.68; // rho/2 * CdA
  const powerTop = Math.cbrt(P / cda) * 3.6;
  return Math.round(Math.min(gearTop, powerTop));
}

export const PAINTS = [
  { id: 'white', name: 'PEARL WHITE', hex: '#f2f2ef' },
  { id: 'black', name: 'MIDNIGHT BLACK', hex: '#121316' },
  { id: 'red', name: 'BLAZE RED', hex: '#c8141c' },
  { id: 'yellow', name: 'SUNBURST YELLOW', hex: '#f2c40c' },
  { id: 'blue', name: 'STORM BLUE', hex: '#1a4fbf' },
  { id: 'silver', name: 'SPARK SILVER', hex: '#a9adb3' },
  { id: 'green', name: 'RACING GREEN', hex: '#0f5b3a' },
  { id: 'orange', name: 'TANGERINE', hex: '#ff6a00' },
  { id: 'purple', name: 'MIDNIGHT PURPLE', hex: '#3a1960' },
  { id: 'panda', name: 'PANDA TWO-TONE', hex: '#f2f2ef', two: '#111111' },
];
export const WHEELS = [
  { id: 'stock', name: 'STOCK 5-SPOKE', spokes: 5, color: '#9aa0a8', price: 0 },
  { id: 'mesh', name: 'MESH 10', spokes: 10, color: '#c9c9c9', price: 2000 },
  { id: 'gold6', name: 'GOLD 6-SPOKE', spokes: 6, color: '#d4a017', price: 2500 },
  { id: 'black8', name: 'BLACK 8-SPOKE', spokes: 8, color: '#1a1a1a', price: 2500 },
  { id: 'white12', name: 'WHITE 12 RACING', spokes: 12, color: '#f0f0f0', price: 3000 },
];
export const SPOILERS = [
  { id: 'none', name: 'NONE', price: 0 },
  { id: 'duck', name: 'DUCKTAIL', price: 1500 },
  { id: 'mid', name: 'MID WING', price: 2500 },
  { id: 'gt', name: 'GT WING', price: 4000 },
];
export const AEROS = [
  { id: 'stock', name: 'STOCK', price: 0 },
  { id: 'street', name: 'STREET KIT', price: 3000 },
  { id: 'wide', name: 'WIDE BODY', price: 6000 },
];
export const MUFFLERS = [
  { id: 'stock', name: 'STOCK SINGLE', price: 0, tips: 1, loud: 0 },
  { id: 'dual', name: 'DUAL TIP', price: 1500, tips: 2, loud: 0.15 },
  { id: 'big', name: 'TITANIUM BIG BORE', price: 2500, tips: 1, big: true, loud: 0.3 },
  { id: 'quad', name: 'QUAD TIP', price: 3000, tips: 4, loud: 0.25 },
];

export const DECALS = [
  { id: 'none', name: 'NONE', price: 0 },
  { id: 'stripe', name: 'RACING STRIPES', price: 1200 },
  { id: 'side', name: 'SIDE FLAME', price: 1500 },
  { id: 'number', name: 'RACE NUMBER', price: 1000 },
  { id: 'rd', name: 'REVOLUTION LOGO', price: 800 },
];
export const RIDE_HEIGHTS = [
  { id: 0, name: 'STOCK', drop: 0 },
  { id: 1, name: 'LOW -20mm', drop: 0.02 },
  { id: 2, name: 'LOWER -40mm', drop: 0.04 },
  { id: 3, name: 'SLAMMED -60mm', drop: 0.06 },
];
export const MAX_GARAGE = 5;
export const defaultDress = () => ({ paint: 'white', wheel: 'stock', spoiler: 'none', aero: 'stock', muffler: 'stock', decal: 'none', height: 0, number: '' });
