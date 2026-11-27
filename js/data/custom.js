// REVOLUTION DRIVE — customization catalogue (dress up v2, wheels, meters, tuning v2)
// All brand names below are FICTIONAL and original to this game.

export const PART_BRANDS = {
  NORMAL: { name: 'Normal', color: '#555', style: 'plain' },
  KAMISPEED: { name: 'KAMI SPEED', color: '#d01020', style: 'slant' },
  RAIDEN: { name: 'RAIDEN WORKS', color: '#1a3fa0', style: 'bolt' },
  ZENITH: { name: 'ZENITH', color: '#111', style: 'wide' },
  HAYABUSA: { name: 'HAYABUSA', color: '#e06a00', style: 'wing' },
  AKATSUKI: { name: 'AKATSUKI R&D', color: '#7a1aa0', style: 'sun' },
  SHINOBI: { name: 'SHINOBI', color: '#1a7a3a', style: 'slant' },
};

// aero categories → variants. Body parts come from the parts model pack (assets/parts/aero_parts.glb,
// mounted by js/world/aeroParts.js): rear wings, front splitter and canards.
export const WING_TYPES = { lip: { df: 0.04, cd: 0.006, price: 1800 }, hoop: { df: 0.10, cd: 0.02, price: 2800 }, mid: { df: 0.13, cd: 0.025, price: 3200 }, gt: { df: 0.18, cd: 0.045, price: 4200 }, swan: { df: 0.21, cd: 0.045, price: 5200 }, swanXL: { df: 0.25, cd: 0.06, price: 6400 } };
export const AERO = {
  fspoiler: { jp: 'フロントスプリッター', icon: 'front', band: '#2a9a3a', list: [
    { id: 0, brand: 'NORMAL', name: 'なし' }, { id: 1, brand: 'ZENITH', name: 'カーボンスプリッター', img: 'assets/parts/thumbs/splitter.png' }, { id: 2, brand: 'RAIDEN', name: 'ボディ同色スプリッター', img: 'assets/parts/thumbs/splitter.png' }] },
  canard: { jp: 'カナード', icon: 'front', band: '#2a9a3a', list: [
    { id: 0, brand: 'NORMAL', name: 'なし' }, { id: 1, brand: 'SHINOBI', name: 'カーボンカナード', img: 'assets/parts/thumbs/canard.png' }, { id: 2, brand: 'KAMISPEED', name: 'ボディ同色カナード', img: 'assets/parts/thumbs/canard.png' }] },
  wing: { jp: 'リアウイング', icon: 'wing', band: '#e06a00', list: [
    { id: 0, brand: 'NORMAL', name: 'なし' },
    { id: 1, brand: 'RAIDEN', name: 'GTウイング TYPE-R', type: 'gt', img: 'assets/parts/thumbs/wing_01.png' },
    { id: 2, brand: 'HAYABUSA', name: 'トランクリップスポイラー', type: 'lip', img: 'assets/parts/thumbs/wing_02.png' },
    { id: 3, brand: 'ZENITH', name: 'センターマウントウイング', type: 'mid', img: 'assets/parts/thumbs/wing_03.png' },
    { id: 4, brand: 'AKATSUKI', name: 'ハイマウントループウイング', type: 'hoop', img: 'assets/parts/thumbs/wing_04.png' },
    { id: 5, brand: 'KAMISPEED', name: 'GTウイング TYPE-S', type: 'gt', img: 'assets/parts/thumbs/wing_05.png' },
    { id: 6, brand: 'SHINOBI', name: 'スリムリップスポイラー', type: 'lip', img: 'assets/parts/thumbs/wing_06.png' },
    { id: 7, brand: 'HAYABUSA', name: 'ラウンドエンドウイング', type: 'mid', img: 'assets/parts/thumbs/wing_07.png' },
    { id: 8, brand: 'KAMISPEED', name: 'GTウイング TYPE-K', type: 'gt', img: 'assets/parts/thumbs/wing_08.png' },
    { id: 9, brand: 'AKATSUKI', name: 'ツイストウイング', type: 'mid', img: 'assets/parts/thumbs/wing_09.png' },
    { id: 10, brand: 'RAIDEN', name: 'ラウンドGTウイング', type: 'gt', img: 'assets/parts/thumbs/wing_10.png' },
    { id: 11, brand: 'HAYABUSA', name: 'ダックテールスポイラー', type: 'lip', img: 'assets/parts/thumbs/wing_11.png' },
    { id: 12, brand: 'ZENITH', name: 'ライトウェイトGTウイング', type: 'gt', img: 'assets/parts/thumbs/wing_12.png' },
    { id: 13, brand: 'SHINOBI', name: '3段ループスポイラー', type: 'hoop', img: 'assets/parts/thumbs/wing_13.png' },
    { id: 14, brand: 'KAMISPEED', name: 'ウェーブGTウイング', type: 'gt', img: 'assets/parts/thumbs/wing_14.png' },
    { id: 15, brand: 'RAIDEN', name: 'スワンネック ハイダウンフォース', type: 'swanXL', img: 'assets/parts/thumbs/wing_15.png' },
    { id: 16, brand: 'ZENITH', name: 'ワイヤーステーGTウイング', type: 'gt', img: 'assets/parts/thumbs/wing_16.png' },
    { id: 17, brand: 'AKATSUKI', name: 'タイムアタックウイング', type: 'swan', img: 'assets/parts/thumbs/wing_17.png' },
    { id: 18, brand: 'RAIDEN', name: 'スワンネックGTウイング', type: 'swan', img: 'assets/parts/thumbs/wing_18.png' },
    { id: 19, brand: 'SHINOBI', name: 'ツインステーGTウイング', type: 'gt', img: 'assets/parts/thumbs/wing_19.png' },
    { id: 20, brand: 'ZENITH', name: 'ワイドエンドプレートウイング', type: 'gt', img: 'assets/parts/thumbs/wing_20.png' },
    { id: 21, brand: 'KAMISPEED', name: 'スワンネック ストリート', type: 'swan', img: 'assets/parts/thumbs/wing_21.png' },
    { id: 22, brand: 'AKATSUKI', name: 'スワンネック レーシング', type: 'swan', img: 'assets/parts/thumbs/wing_22.png' },
    { id: 23, brand: 'HAYABUSA', name: 'ボディ同色リアスポイラー', type: 'lip', img: 'assets/parts/thumbs/wing_23.png' }] },
  calipers: { jp: 'ブレーキキャリパー', icon: 'wheel', band: '#c01020', list: [
    { id: 0, brand: 'NORMAL', name: 'ノーマル' }, { id: 1, brand: 'AKATSUKI', name: '4ポッドキャリパー(レッド)' }, { id: 2, brand: 'RAIDEN', name: '6ポッドビッグキット(ゴールド)' }] },
  suspkit: { jp: 'サスペンション', icon: 'height', band: '#c01020', list: [
    { id: 0, brand: 'NORMAL', name: 'ノーマル' }, { id: 1, brand: 'SHINOBI', name: 'ストリート車高調' }, { id: 2, brand: 'KAMISPEED', name: 'スポーツ車高調' }, { id: 3, brand: 'ZENITH', name: 'レーシング車高調' }] },
  muffler: { jp: 'マフラー', icon: 'muffler', band: '#1a7ad0', list: [
    { id: 'stock', brand: 'NORMAL', name: 'ノーマル' }, { id: 'dual', brand: 'HAYABUSA', name: 'デュアルテール' }, { id: 'big', brand: 'KAMISPEED', name: 'チタン砲弾' }, { id: 'quad', brand: 'RAIDEN', name: '4本出し' }] },
};
const wingType = (id) => WING_TYPES[(AERO.wing.list.find(w => w.id === id) || {}).type] || null;

// IN-STORE prices (credits). id 0 / 'stock' is always owned.
export const PART_PRICE = { fspoiler: 2500, flip: 1500, side: 2000, rbumper: 2000, diffuser: 2500, rspoiler: 1500, wing: 3000, bonnet: 2500, canard: 1200, fender: 3500, intake: 2000, intercooler: 3500, calipers: 2500, suspkit: 3000, muffler: 2000, wheel: 2000, vinyl: 800, color: 0 };
export const partPrice = (cat, id) => (id === 0 || id === 'stock' || id === 'none' || id === 'stock5') ? 0 : cat === 'wing' && wingType(id) ? wingType(id).price : Math.round((PART_PRICE[cat] || 1500) * (1 + (typeof id === 'number' ? (id - 1) * 0.35 : 0)));
export const partKey = (cat, id) => `${cat}:${id}`;
// parts a body style cannot physically take
export const INCOMPATIBLE = {
  roadster: { rspoiler: [2] },          // no roof → no roof spoiler
  hatch: { rspoiler: [1] },             // hatchback: no trunk ducktail
  sedan: {},
  coupe: {},
};
export const isCompatible = (style, cat, id) => !((INCOMPATIBLE[style] || {})[cat] || []).includes(id);

// ---- paint ----
export const FINISHES = [
  { id: 'gloss', name: 'GLOSS', jp: 'グロス' },
  { id: 'metallic', name: 'METALLIC', jp: 'メタリック' },
  { id: 'pearl', name: 'PEARL', jp: 'パール' },
  { id: 'matte', name: 'MATTE', jp: 'マット' },
];
export const PALETTE = [
  ['ホワイト', '#f2f2ef'], ['シルバー', '#a9adb3'], ['ガンメタ', '#4a4e55'], ['ブラック', '#121316'],
  ['レッド', '#c8141c'], ['ワインレッド', '#6a0f1a'], ['オレンジ', '#ff6a00'], ['イエロー', '#f2c40c'],
  ['ライム', '#9adf1a'], ['グリーン', '#0f5b3a'], ['ミント', '#5adcb0'], ['ターコイズ', '#0aa0b0'],
  ['スカイ', '#4ab8ff'], ['ブルー', '#1a4fbf'], ['ネイビー', '#0e1e4a'], ['パープル', '#3a1960'],
  ['ピンク', '#ff5aa0'], ['ゴールド', '#c9a227'], ['ブロンズ', '#8a5a2a'], ['ベージュ', '#d8c8a0'],
  ['チャンピオンホワイト', '#fffdf0'], ['ミッドナイトパープル', '#2a1a4a'], ['ブリティッシュグリーン', '#123a26'], ['カッパー', '#b0603a'],
];

// ---- vinyls ----
export const VINYL_SLOTS = {
  side: { jp: 'サイドステッカー', designs: ['none', 'flame', 'lines', 'number', 'logo', 'tribal', 'kanji'] },
  hood: { jp: 'ボンネットステッカー', designs: ['none', 'logo', 'kanji', 'stripe', 'tribal'] },
  rear: { jp: 'リアステッカー', designs: ['none', 'logo', 'text', 'kanji'] },
  stripe: { jp: 'ストライプ', designs: ['none', 'twin', 'single', 'offset'] },
};
export const VINYL_NAMES = { none: 'なし', flame: 'フレイム', lines: 'スピードライン', number: 'ゼッケン', logo: 'REVOLUTIONロゴ', tribal: 'トライバル', kanji: '漢字「峠」', stripe: 'センターライン', text: 'チーム名', twin: 'ツインストライプ', single: 'シングルストライプ', offset: 'オフセットストライプ' };

// ---- wheels ----
export const WHEEL_BRANDS = {
  TSURUGI: { name: 'TSURUGI', jp: 'ツルギ', color: '#c01020' },
  HOSHI: { name: 'HOSHI FORGED', jp: 'ホシ', color: '#1a5ad0' },
  ORBIT: { name: 'ORBIT', jp: 'オービット', color: '#222' },
  KAZEWHEEL: { name: 'KAZE WHEELS', jp: 'カゼ', color: '#e07a00' },
};
// shape: spoke pattern used by the 3D model and the thumbnail painter
export const WHEEL_DESIGNS = [
  { id: 'stock5', brand: null, name: 'Normal', shape: 'spoke', n: 5, w: 0.06 },
  { id: 'ts_6', brand: 'TSURUGI', name: 'TS-6 RACING', shape: 'spoke', n: 6, w: 0.05 },
  { id: 'ts_twin', brand: 'TSURUGI', name: 'TS-TWIN5', shape: 'twin', n: 5, w: 0.03 },
  { id: 'hs_mesh', brand: 'HOSHI', name: 'HS MESH-10', shape: 'mesh', n: 10, w: 0.025 },
  { id: 'hs_dish', brand: 'HOSHI', name: 'HS DEEP DISH', shape: 'dish', n: 8, w: 0.05 },
  { id: 'ob_10', brand: 'ORBIT', name: 'OB-10 FINE', shape: 'spoke', n: 10, w: 0.025 },
  { id: 'ob_multi', brand: 'ORBIT', name: 'OB MULTI 12', shape: 'spoke', n: 12, w: 0.02 },
  { id: 'kz_star', brand: 'KAZEWHEEL', name: 'KZ STAR 5', shape: 'star', n: 5, w: 0.045 },
  { id: 'kz_turbo', brand: 'KAZEWHEEL', name: 'KZ TURBINE', shape: 'turbine', n: 14, w: 0.02 },
];
export const WHEEL_COLORS = [['シルバー', '#c9ccd0'], ['ガンメタ', '#4a4e55'], ['ブラック', '#161616'], ['ホワイト', '#f2f2f2'], ['ゴールド', '#d4a017'], ['ブロンズ', '#8a6a3a'], ['レッド', '#c01020'], ['ブルー', '#1a5ad0'], ['クローム', '#e8e8e8']];
export const WHEEL_SIZES = [15, 16, 17, 18, 19];
export const WHEEL_OFFSETS = [-2, -1, 0, 1, 2, 3]; // + pushes the wheel out (more aggressive stance)
export const TIRE_WIDTHS = [-10, 0, 10, 20, 30]; // mm relative to stock
export const TIRE_LOOKS = [{ id: 'normal', name: 'ノーマル' }, { id: 'letter', name: 'ホワイトレター' }, { id: 'stretch', name: '引っ張りタイヤ' }, { id: 'slick', name: 'セミスリック' }];

// ---- meters ----
export const METERS = [
  { id: 'default', name: 'DEFAULT', jp: 'デフォルト' },
  { id: 'infinity', name: 'INFINITY', jp: 'インフィニティ' },
  { id: 'formula', name: 'FORMULA', jp: 'フォーミュラ' },
  { id: 'future', name: 'FUTURE', jp: 'フューチャー' },
  { id: 'digital', name: 'DIGITAL', jp: 'デジタル' },
  { id: 'classic', name: 'CLASSIC', jp: 'クラシック' },
  { id: 'sport', name: 'SPORT', jp: 'スポーツ' },
  { id: 'racing', name: 'RACING', jp: 'レーシング' },
];
export const METER_BGS = [['ダーク', 'dark'], ['カーボン', 'carbon'], ['ホワイト', 'white'], ['スモーク', 'smoke']];
export const METER_TEXT = [['ホワイト', '#ffffff'], ['イエロー', '#ffd400'], ['オレンジ', '#ff8a00'], ['シアン', '#36d8ff'], ['グリーン', '#5aff8a'], ['レッド', '#ff4040']];
export const METER_LIGHT = [['オレンジ', '#ff7a00'], ['レッド', '#ff2a3a'], ['ブルー', '#2a8aff'], ['グリーン', '#2aff6a'], ['パープル', '#b04aff'], ['ホワイト', '#e8f0ff']];
export const defaultMeter = () => ({ design: 'default', bg: 'dark', text: '#ffffff', light: '#ff7a00' });

// ---- tuning v2 ----
// each part: up to Lv.5, cost in Tune POINTs grows per level. fx: effect per level on the spec.
export const TUNE_CATS = [
  { id: 'engine', name: 'ENGINE', jp: 'エンジン', parts: [
    { id: 'power', jp: 'エンジン出力', desc: 'ピストン・カムを強化し最高出力を高めます。', fx: { power: 4 } },
    { id: 'ecu', jp: 'ECU', desc: '燃調・点火時期を最適化。高回転まで回るようになります。', fx: { power: 2, rev: 120 } },
    { id: 'intake', jp: '吸排気系', desc: 'エアクリーナーとマフラーで吸排気効率を上げます。', fx: { power: 2, accel: 1 } },
    { id: 'turbo', jp: 'ターボ', desc: 'タービン強化。ターボ車専用。ブーストの立ち上がりも鋭く。', fx: { power: 4, boost: 1 }, turboOnly: true },
  ] },
  { id: 'drivetrain', name: 'DRIVETRAIN', jp: '駆動系', parts: [
    { id: 'trans', jp: 'トランスミッション', desc: 'クロスミッションで加速と変速速度を向上。', fx: { accel: 2, shift: 1 } },
    { id: 'clutch', jp: 'クラッチ', desc: '強化クラッチでパワー伝達とスタートダッシュを改善。', fx: { accel: 1, launch: 1 } },
    { id: 'diff', jp: 'デファレンシャル', desc: 'LSDでトラクションを確保。ドリフト中の姿勢も安定。', fx: { traction: 1, stab: 1 } },
  ] },
  { id: 'suspension', name: 'SUSPENSION', jp: '足回り', parts: [
    { id: 'susp', jp: 'サスペンション', desc: '車高調で荷重移動を抑え、コーナリング性能を上げます。', fx: { handling: 2, stab: 1 } },
    { id: 'camber', jp: 'キャンバー', desc: 'ネガティブキャンバーでコーナーでの接地を高めます。', fx: { grip: 1, handling: 1 } },
    { id: 'align', jp: 'アライメント', desc: 'トー・キャスター調整でステアリングの応答性を向上。', fx: { handling: 1, steer: 1 } },
  ] },
  { id: 'brakes', name: 'BRAKES', jp: 'ブレーキ', parts: [
    { id: 'brake', jp: 'ブレーキ', desc: 'ブレーキ容量を上げ、制動距離を短縮します。', fx: { brake: 5 } },
    { id: 'brakeparts', jp: 'ブレーキパーツ', desc: '大径ローター・対向キャリパーでコントロール性を向上。', fx: { brake: 3, stab: 0.5 } },
  ] },
  { id: 'body', name: 'BODY', jp: 'ボディ', parts: [
    { id: 'weight', jp: '軽量化', desc: '内装を外して車重を軽くします。全性能に効きます。', fx: { weight: 2 } },
    { id: 'rigidity', jp: 'ボディ剛性', desc: 'スポット増しでボディのよじれを抑えます。', fx: { stab: 1, handling: 1 } },
    { id: 'rollbar', jp: 'ロールバー', desc: 'ボディ剛性を強化します!', fx: { stab: 1.5 } },
  ] },
  { id: 'tires', name: 'TIRES', jp: 'タイヤ', parts: [
    { id: 'tire', jp: 'タイヤ', desc: 'ハイグリップタイヤでグリップ限界を引き上げます。', fx: { grip: 2 } },
    { id: 'compound', jp: 'グリップ性能', desc: 'コンパウンド変更で滑り出しを穏やかにします。', fx: { grip: 1, stab: 0.5 } },
  ] },
];
export const TUNE_PARTS_V2 = TUNE_CATS.flatMap(c => c.parts.map(p => ({ ...p, cat: c.id })));
export const TUNE_MAX = 5;
export const tuneCost = (lv) => [0, 10, 15, 20, 30, 40][lv] || 0; // points to reach level lv
export const tuneTotal = (tune = {}) => TUNE_PARTS_V2.reduce((s, p) => s + (tune[p.id] || 0), 0);
export const TUNE_STYLES = [[0, 'ノーマル'], [10, 'ライトチューン'], [25, 'ストリートチューン'], [45, 'スポーツチューン'], [65, 'フルチューン']];
export const tuneStyle = (total) => TUNE_STYLES.filter(([n]) => total >= n).pop()[1];

// ---- migration from earlier saves ----
const V1_TUNE = { engine: ['power', 'ecu'], turbo: ['intake', 'turbo'], weight: ['weight'], tires: ['tire'], suspension: ['susp'], brakes: ['brake'], gearbox: ['trans'] };
export function normalizeCar(gc, spec) {
  const d = gc.dress || {};
  if (!d.v2) {
    const paintHex = { white: '#f2f2ef', black: '#121316', red: '#c8141c', yellow: '#f2c40c', blue: '#1a4fbf', silver: '#a9adb3', green: '#0f5b3a', orange: '#ff6a00', purple: '#3a1960', panda: '#f2f2ef' }[d.paint] || '#f2f2ef';
    const wheelMap = { stock: ['stock5', '#c9ccd0'], mesh: ['hs_mesh', '#c9ccd0'], gold6: ['ts_6', '#d4a017'], black8: ['ob_10', '#161616'], white12: ['ob_multi', '#f2f2f2'] }[d.wheel] || ['stock5', '#c9ccd0'];
    gc.dress = {
      v2: true,
      color: d.color && d.color.hex ? { hex: d.color.hex, finish: d.color.finish || 'metallic' } : { hex: paintHex, finish: paintHex === '#f2f2ef' ? 'gloss' : 'metallic' },
      vinyl: { side: { d: d.decal === 'side' ? 'flame' : d.decal === 'number' ? 'number' : d.decal === 'rd' ? 'logo' : 'none', x: 0, y: 0, s: 1, r: 0 }, hood: { d: 'none', x: 0, y: 0, s: 1, r: 0 }, rear: { d: 'none', x: 0, y: 0, s: 1, r: 0 }, stripe: { d: d.decal === 'stripe' ? 'twin' : 'none', x: 0, y: 0, s: 1, r: 0 } },
      aero: { diffuser: 0, intake: 0, intercooler: 0, calipers: 0, suspkit: 0, fspoiler: d.aero !== 'stock' && d.aero ? 1 : 0, flip: d.aero !== 'stock' && d.aero ? 1 : 0, side: d.aero !== 'stock' && d.aero ? 1 : 0, rbumper: 0, rspoiler: d.spoiler === 'duck' ? 1 : 0, wing: d.spoiler === 'mid' ? 1 : d.spoiler === 'gt' ? 2 : 0, bonnet: 0, canard: 0, fender: d.aero === 'wide' ? 2 : 0 },
      wheel: { f: { design: wheelMap[0], color: wheelMap[1], rim: wheelMap[1], size: 16, offset: 0 }, r: { design: wheelMap[0], color: wheelMap[1], rim: wheelMap[1], size: 16, offset: 0 }, link: true, tire: 'normal' },
      muffler: d.muffler || 'stock', height: d.height || 0, number: d.number || '',
    };
  }
  if (!gc.tune || !gc.tune.v2) {
    const old = gc.tune || {}; const t = { v2: true };
    for (const [k, ids] of Object.entries(V1_TUNE)) if (old[k]) ids.forEach(id => t[id] = Math.min(TUNE_MAX, Math.round(old[k] * 5 / 3)));
    gc.tune = t;
  }
  for (const k of ['diffuser', 'intake', 'intercooler', 'calipers', 'suspkit']) gc.dress.aero[k] ??= 0;
  gc.dress.wheel.tireW ??= 0;
  gc.meter ||= defaultMeter();
  return gc;
}
export const defaultDressV2 = () => normalizeCar({ dress: {} }).dress;

// ---- performance effect of equipped parts (applied in buildSpec) ----
export function partEffects(dress, base) {
  const fx = { power: 0, downforce: 0, cda: 0, mass: 0, grip: 0, brake: 0, susp: 0, cg: 0 };
  if (!dress || !dress.v2) return fx;
  const A = dress.aero || {};
  const wt = wingType(A.wing); if (wt) { fx.downforce += wt.df; fx.cda += wt.cd; }
  fx.downforce += (A.fspoiler ? 0.03 : 0) + (A.canard ? 0.02 : 0);
  fx.cda += (A.fspoiler ? 0.01 : 0) + (A.canard ? 0.006 : 0);
  fx.power += { stock: 0, dual: 1, big: 2, quad: 2 }[dress.muffler] || 0;
  fx.brake += [0, 0.04, 0.08][A.calipers || 0];
  fx.susp += [0, 0.5, 1.0, 1.5][A.suspkit || 0];
  const tw = dress.wheel?.tireW || 0; fx.grip += tw * 0.0013; fx.cda += Math.max(0, tw) * 0.0004;
  const drop = [0, 0.02, 0.04, 0.06][dress.height || 0]; fx.cg -= drop * 0.8;
  return fx;
}
