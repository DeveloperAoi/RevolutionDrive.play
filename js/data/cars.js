// REVOLUTION DRIVE — vehicle catalogue
import { TUNE_PARTS_V2, partEffects } from './custom.js';
// All manufacturers, model names and designs are ORIGINAL to this game.
// No real-world brand, badge or body design is reproduced.

export const MAKERS = {
  KAZEMOTO: { name: 'KAZEMOTO', jp: '風本自動車', color: '#ff3b3b' },
  RYUJIN:   { name: 'RYUJIN',   jp: '龍神モータース', color: '#ffb300' },
  SORAWORKS:{ name: 'SORA WORKS', jp: 'ソラワークス', color: '#3bb3ff' },
  TSUBAME:  { name: 'TSUBAME',  jp: 'ツバメ工業', color: '#7dff5a' },
  KUROGANE: { name: 'KUROGANE', jp: '鉄重工', color: '#8a8f98' },
  AOBA:     { name: 'AOBA', jp: '青葉モータース', color: '#1a5ad0' },
};

// torque curve: [rpm, fraction of peak torque]
// engine.type drives the procedural engine sound (see audio/engine.js)
export const CARS = [
  {
    id: 'kaze_rs', disp: 1587, category: 'LIGHTWEIGHT', catJp: 'ライトウェイト', maker: 'KAZEMOTO', name: 'KAZE RS', jp: 'カゼ RS', year: 1986, price: 0,
    desc: '軽さが武器の小型FRクーペ。非力だが、峠では誰よりも素直に曲がる。',
    drive: 'FR', mass: 950, wheelbase: 2.40, cgHeight: 0.48, weightFront: 0.53,
    body: { len: 4.20, wid: 1.63, hgt: 1.33, style: 'hatch', shape: 'retroHatch', head: 'popup', tail: 'bar', features: ['bumper80'] },
    model: { pack: 'kaze', node: 'KAZE_RS', scale: 0.435, popup: { close: 0.8, sink: 0.04 } },
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
    body: { len: 4.18, wid: 1.70, hgt: 1.36, style: 'hatch', shape: 'hotHatch', head: 'slim', tail: 'bar', features: ['scoop'] },
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
    body: { len: 4.14, wid: 1.75, hgt: 1.28, style: 'roadster', shape: 'roadster', head: 'slim', tail: 'bar' },
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
    body: { len: 4.29, wid: 1.76, hgt: 1.23, style: 'coupe', shape: 'curvyCoupe', head: 'lowslim', tail: 'round' },
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
    body: { len: 4.60, wid: 1.79, hgt: 1.36, style: 'coupe', shape: 'gtCoupe', head: 'big', tail: 'round' },
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
    body: { len: 4.49, wid: 1.77, hgt: 1.45, style: 'sedan', shape: 'rallySedan', head: 'big', tail: 'bar', features: ['scoop'] },
    engine: { type: 'TURBO4', cyl: 4, hp: 300, torque: 400, idle: 900, redline: 7200, limiter: 7500,
      curve: [[900, .40], [2800, .85], [3600, 1.0], [5500, .92], [7500, .70]], inertia: 1.0 },
    gears: [2.86, 1.92, 1.36, 1.05, 0.83, 0.66], final: 4.53, reverse: 3.0,
    tire: { grip: 1.06, radius: 0.32, width: 235 }, brake: 1.12, steerLock: 0.60, downforce: 0.20,
    sound: { pitch: 0.95, rasp: 0.85, turbo: true },
  },
  {
    id: 'sylph_180x', disp: 1809, category: 'DRIFT', catJp: 'ドリフト', maker: 'KAZEMOTO', name: 'SYLPH 180X', jp: 'シルフ 180X', year: 1989, price: 16000,
    desc: '軽量ターボFRのノッチバッククーペ。リトラクタブルライトのドリフト入門機。',
    drive: 'FR', mass: 1180, wheelbase: 2.47, cgHeight: 0.48, weightFront: 0.55,
    body: { len: 4.52, wid: 1.69, hgt: 1.29, style: 'coupe', shape: 'notchCoupe', head: 'popup', tail: 'full' },
    engine: { type: 'TURBO4', cyl: 4, hp: 205, torque: 274, idle: 850, redline: 7000, limiter: 7300,
      curve: [[850, .45], [2500, .80], [4000, 1.0], [5800, .92], [7300, .70]], inertia: 1.0 },
    gears: [3.32, 1.90, 1.31, 1.00, 0.81], final: 4.08, reverse: 3.38,
    tire: { grip: 1.0, radius: 0.30, width: 205 }, brake: 1.0, steerLock: 0.66, downforce: 0.05, cda: 0.70,
    sound: { pitch: 1.0, rasp: 0.75, turbo: true },
  },
  {
    id: 'sylph_specr', disp: 1998, category: 'DRIFT', catJp: 'ドリフト', maker: 'KAZEMOTO', name: 'SYLPH SPEC-R', jp: 'シルフ スペックR', year: 1999, price: 30000,
    desc: '6速ターボFRの最終進化型。シャープな切れ味と高いコントロール性を両立。',
    drive: 'FR', mass: 1240, wheelbase: 2.53, cgHeight: 0.47, weightFront: 0.55,
    body: { len: 4.45, wid: 1.70, hgt: 1.29, style: 'coupe', shape: 'sleekCoupe', head: 'slim', tail: 'bar' },
    engine: { type: 'TURBO4', cyl: 4, hp: 250, torque: 275, idle: 850, redline: 7400, limiter: 7700,
      curve: [[850, .45], [2600, .82], [4800, 1.0], [6400, .92], [7700, .72]], inertia: 0.95 },
    gears: [3.32, 1.90, 1.31, 1.00, 0.86, 0.73], final: 4.08, reverse: 3.38,
    tire: { grip: 1.04, radius: 0.31, width: 225 }, brake: 1.08, steerLock: 0.66, downforce: 0.12, cda: 0.66,
    sound: { pitch: 1.05, rasp: 0.7, turbo: true },
  },
  {
    id: 'ryujin_r5', disp: 1308, category: 'ROTARY', catJp: 'ロータリー', maker: 'RYUJIN', name: 'RYUJIN R-5', jp: 'リュウジン R-5', year: 1989, price: 20000,
    desc: '先代ロータリーターボ。ウェッジシェイプとリトラが光る、軽快なFR。',
    drive: 'FR', mass: 1220, wheelbase: 2.43, cgHeight: 0.47, weightFront: 0.51,
    body: { len: 4.32, wid: 1.69, hgt: 1.27, style: 'coupe', shape: 'wedgeCoupe', head: 'popup', tail: 'bar' },
    engine: { type: 'ROTARY', cyl: 2, hp: 205, torque: 270, idle: 950, redline: 7500, limiter: 7800,
      curve: [[950, .45], [2800, .78], [4500, 1.0], [6200, .93], [7800, .78]], inertia: 0.75 },
    gears: [3.48, 2.02, 1.39, 1.00, 0.76], final: 4.10, reverse: 3.04,
    tire: { grip: 1.02, radius: 0.30, width: 205 }, brake: 1.02, steerLock: 0.63, downforce: 0.08, cda: 0.64,
    sound: { pitch: 0.95, rasp: 0.95, turbo: true },
  },
  {
    id: 'sora_gt3', disp: 2568, category: 'POWER', catJp: 'パワー', maker: 'SORAWORKS', name: 'SORA GT-3', jp: 'ソラ GT-3', year: 1989, price: 36000,
    desc: '直6ツインターボ+電子制御4WDを初搭載した初代モンスター。コンパクトで俊敏。',
    drive: '4WD', split: 0.3, mass: 1430, wheelbase: 2.62, cgHeight: 0.50, weightFront: 0.58,
    body: { len: 4.55, wid: 1.76, hgt: 1.34, style: 'coupe', shape: 'compactGT', head: 'rect', tail: 'round' },
    engine: { type: 'TURBO6', cyl: 6, hp: 290, torque: 360, idle: 900, redline: 7600, limiter: 8000,
      curve: [[900, .40], [2500, .72], [4400, 1.0], [6000, .96], [8000, .76]], inertia: 1.05 },
    gears: [3.21, 1.93, 1.30, 1.00, 0.75], final: 4.11, reverse: 3.51,
    tire: { grip: 1.05, radius: 0.31, width: 225 }, brake: 1.1, steerLock: 0.58, downforce: 0.18, cda: 0.70,
    sound: { pitch: 0.95, rasp: 0.65, turbo: true },
  },
  {
    id: 'sora_gt5', disp: 2568, category: 'POWER', catJp: 'パワー', maker: 'SORAWORKS', name: 'SORA GT-5', jp: 'ソラ GT-5', year: 2001, price: 52000,
    desc: '直6シリーズ最終型。角張ったボディと大型ウイングで最高速域の安定感は随一。',
    drive: '4WD', split: 0.35, mass: 1560, wheelbase: 2.67, cgHeight: 0.50, weightFront: 0.55,
    body: { len: 4.60, wid: 1.79, hgt: 1.36, style: 'coupe', shape: 'angularGT', head: 'angular', tail: 'round', features: ['wing'] },
    engine: { type: 'TURBO6', cyl: 6, hp: 345, torque: 400, idle: 900, redline: 7800, limiter: 8100,
      curve: [[900, .40], [2500, .72], [4400, 1.0], [6200, .97], [8100, .78]], inertia: 1.1 },
    gears: [3.83, 2.36, 1.69, 1.31, 1.00, 0.79], final: 3.55, reverse: 3.28,
    tire: { grip: 1.09, radius: 0.32, width: 245 }, brake: 1.18, steerLock: 0.58, downforce: 0.30, cda: 0.69,
    sound: { pitch: 0.92, rasp: 0.7, turbo: true },
  },
  {
    id: 'kurogane_supreme', disp: 2997, category: 'GT', catJp: 'グランツーリスモ', maker: 'KUROGANE', name: 'KUROGANE SUPREME', jp: 'クロガネ スプリーム', year: 1997, price: 48000,
    desc: '3.0L直6ツインターボの丸みを帯びたFR-GT。チューニング次第で青天井のパワー。',
    drive: 'FR', mass: 1510, wheelbase: 2.55, cgHeight: 0.49, weightFront: 0.54,
    body: { len: 4.52, wid: 1.81, hgt: 1.28, style: 'coupe', shape: 'longGT', head: 'oval', tail: 'roundBig', features: ['hoopwing'] },
    engine: { type: 'TURBO6', cyl: 6, hp: 330, torque: 451, idle: 800, redline: 6800, limiter: 7100,
      curve: [[800, .42], [2200, .78], [3600, 1.0], [5200, .95], [7100, .74]], inertia: 1.15 },
    gears: [3.83, 2.36, 1.69, 1.31, 1.00, 0.79], final: 3.27, reverse: 3.28,
    tire: { grip: 1.07, radius: 0.32, width: 245 }, brake: 1.15, steerLock: 0.60, downforce: 0.20, cda: 0.66,
    sound: { pitch: 0.88, rasp: 0.6, turbo: true },
  },
  {
    id: 'tsubame_86n', disp: 2387, category: 'LIGHTWEIGHT', catJp: 'ライトウェイト', maker: 'TSUBAME', name: 'TSUBAME 86 NEXT', jp: 'ツバメ 86ネクスト', year: 2021, price: 28000,
    desc: '水平対向NAを低く積んだ現代のFRスポーツ。低重心で素直な挙動が魅力。',
    drive: 'FR', mass: 1270, wheelbase: 2.575, cgHeight: 0.46, weightFront: 0.53,
    body: { len: 4.27, wid: 1.78, hgt: 1.31, style: 'coupe', shape: 'modernCoupe', head: 'swept', tail: 'bar' },
    engine: { type: 'BOXER4', cyl: 4, hp: 235, torque: 250, idle: 800, redline: 7400, limiter: 7600,
      curve: [[800, .55], [3000, .82], [3700, 1.0], [6000, .95], [7600, .82]], inertia: 0.9 },
    gears: [3.63, 2.19, 1.54, 1.21, 1.00, 0.77], final: 4.30, reverse: 3.44,
    tire: { grip: 1.03, radius: 0.31, width: 215 }, brake: 1.08, steerLock: 0.64, downforce: 0.10, cda: 0.64,
    sound: { pitch: 1.0, rasp: 0.55, turbo: false },
  },
  {
    id: 'aoba_skybolt', disp: 1994, category: 'TRACTION', catJp: 'トラクション', maker: 'AOBA', name: 'AOBA SKYBOLT 4', jp: 'アオバ スカイボルト4', year: 2004, price: 40000,
    desc: '水平対向ターボ×シンメトリカル4WDのラリーセダン。独特の鼓動とボンネットの大型スクープ。',
    drive: '4WD', split: 0.41, mass: 1440, wheelbase: 2.53, cgHeight: 0.50, weightFront: 0.59,
    body: { len: 4.47, wid: 1.74, hgt: 1.42, style: 'sedan', shape: 'rallySedan2', head: 'big', tail: 'round', features: ['scoop', 'wing'] },
    engine: { type: 'BOXERT', cyl: 4, hp: 300, torque: 407, idle: 850, redline: 7600, limiter: 8000,
      curve: [[850, .40], [2800, .80], [4400, 1.0], [6000, .92], [8000, .70]], inertia: 1.0 },
    gears: [3.64, 2.24, 1.52, 1.13, 0.92, 0.75], final: 3.90, reverse: 3.55,
    tire: { grip: 1.06, radius: 0.32, width: 235 }, brake: 1.12, steerLock: 0.60, downforce: 0.20, cda: 0.72,
    sound: { pitch: 0.9, rasp: 0.8, turbo: true },
  },
  {
    id: 'kurogane_seiran', disp: 2491, category: 'DRIFT', catJp: 'ドリフト', maker: 'KUROGANE', name: 'KUROGANE SEIRAN TV', jp: 'クロガネ セイラン TV', year: 1998, price: 34000,
    desc: '2.5L直6ターボを積んだ4ドアFRスポーツセダン。長いホイールベースで大きな角度を安定して保てる。',
    drive: 'FR', mass: 1470, wheelbase: 2.73, cgHeight: 0.52, weightFront: 0.55,
    body: { len: 4.72, wid: 1.76, hgt: 1.40, style: 'sedan', shape: 'luxSedan', head: 'quad', tail: 'garnish' },
    engine: { type: 'TURBO6', cyl: 6, hp: 280, torque: 378, idle: 750, redline: 6800, limiter: 7200,
      curve: [[750, .45], [2400, .82], [3600, 1.0], [5400, .95], [7200, .72]], inertia: 1.1 },
    gears: [3.47, 2.06, 1.39, 1.00, 0.84], final: 3.92, reverse: 3.39,
    tire: { grip: 1.04, radius: 0.32, width: 225 }, brake: 1.06, steerLock: 0.66, downforce: 0.08, cda: 0.70,
    sound: { pitch: 0.9, rasp: 0.55, turbo: true },
  },
  {
    id: 'sora_vortex', disp: 5000, category: 'HYPER', catJp: 'ハイパーカー', maker: 'SORAWORKS', name: 'SORA VORTEX TS', jp: 'ソラ ヴォルテックス TS', year: 2024, price: 120000,
    desc: 'ツインターボを積んだミッドシップ・ハイパーカー。圧倒的な加速と高速域の安定感。 (3Dモデル: ProbablyNotG (CC BY 4.0))',
    drive: 'FR', mass: 1450, wheelbase: 2.8, cgHeight: 0.42, weightFront: 0.42,
    body: { len: 4.79, wid: 2.02, hgt: 1.14, style: 'coupe', shape: 'wedgeCoupe', head: 'slim', tail: 'full' },
    engine: { type: 'TURBO6', cyl: 8, hp: 620, torque: 700, idle: 900, redline: 8200, limiter: 8600, curve: [[900, .45], [3000, .85], [5000, 1.0], [7000, .95], [8600, .8]], inertia: 0.9 },
    gears: [3.1, 2.1, 1.6, 1.28, 1.05, 0.88, 0.74], final: 3.6, reverse: 3.3,
    tire: { grip: 1.18, radius: 0.36, width: 305 }, brake: 1.3, steerLock: 0.55, downforce: 0.45, cda: 0.6,
    sound: { pitch: 1.05, rasp: 0.7, turbo: true },
    model: { pack: 'lowpoly', node: 'Zenvo' },
  },
  {
    id: 'kazemoto_terra', disp: 5204, category: 'TRACTION', catJp: 'トラクション', maker: 'KAZEMOTO', name: 'KAZEMOTO TERRA V10', jp: 'カゼモト テラ V10', year: 2023, price: 95000,
    desc: '車高を上げた4WDスーパーカー。路面を選ばない高いトラクションで峠の立ち上がりが速い。 (3Dモデル: ProbablyNotG (CC BY 4.0))',
    drive: '4WD', split: 0.45, mass: 1470, wheelbase: 2.6, cgHeight: 0.48, weightFront: 0.43,
    body: { len: 4.45, wid: 1.91, hgt: 1.24, style: 'coupe', shape: 'wedgeCoupe', head: 'slim', tail: 'bar' },
    engine: { type: 'NA6', cyl: 10, hp: 610, torque: 560, idle: 1000, redline: 8500, limiter: 8700, curve: [[1000, .4], [3500, .75], [6500, 1.0], [8000, .96], [8700, .88]], inertia: 0.85 },
    gears: [3.13, 2.59, 1.96, 1.57, 1.29, 1.08, 0.87], final: 3.2, reverse: 3.3,
    tire: { grip: 1.12, radius: 0.36, width: 285 }, brake: 1.25, steerLock: 0.58, downforce: 0.3, cda: 0.68,
    sound: { pitch: 1.15, rasp: 0.9, turbo: false },
    model: { pack: 'lowpoly', node: 'Sterrato' },
  },
  {
    id: 'tsubame_arc', disp: 2993, category: 'HYBRID', catJp: 'ハイブリッド', maker: 'TSUBAME', name: 'TSUBAME ARC HYBRID', jp: 'ツバメ アーク ハイブリッド', year: 2022, price: 88000,
    desc: '軽量カーボンボディのミッドシップ・ハイブリッド。モーターの即応トルクでコーナーの脱出が鋭い。 (3Dモデル: ProbablyNotG (CC BY 4.0))',
    drive: 'FR', mass: 1400, wheelbase: 2.63, cgHeight: 0.43, weightFront: 0.42,
    body: { len: 4.54, wid: 1.91, hgt: 1.23, style: 'coupe', shape: 'sleekCoupe', head: 'swept', tail: 'bar' },
    engine: { type: 'V6T', cyl: 6, hp: 580, torque: 720, idle: 900, redline: 8000, limiter: 8500, curve: [[900, .7], [2500, .95], [4500, 1.0], [7000, .9], [8500, .75]], inertia: 0.8 },
    gears: [3.2, 2.2, 1.65, 1.3, 1.07, 0.9, 0.76, 0.66], final: 3.4, reverse: 3.3,
    tire: { grip: 1.15, radius: 0.36, width: 295 }, brake: 1.28, steerLock: 0.58, downforce: 0.4, cda: 0.62,
    sound: { pitch: 1.0, rasp: 0.6, turbo: true },
    model: { pack: 'lowpoly', node: 'Artura' },
  },
  {
    id: 'kurogane_lumen', disp: 2999, category: 'LUXURY', catJp: 'ラグジュアリー', maker: 'KUROGANE', name: 'KUROGANE LUMEN S', jp: 'クロガネ ルーメン S', year: 2023, price: 72000,
    desc: '全長5mを超える大型サルーン。重い車体を太いトルクで押し出す、意外な峠の伏兵。 (3Dモデル: ProbablyNotG (CC BY 4.0))',
    drive: '4WD', split: 0.4, mass: 2050, wheelbase: 3.2, cgHeight: 0.52, weightFront: 0.52,
    body: { len: 5.21, wid: 1.92, hgt: 1.56, style: 'sedan', shape: 'luxSedan', head: 'slim', tail: 'full' },
    engine: { type: 'TURBO6', cyl: 6, hp: 520, torque: 760, idle: 650, redline: 6500, limiter: 6800, curve: [[650, .6], [1800, .95], [3000, 1.0], [5500, .9], [6800, .75]], inertia: 1.2 },
    gears: [4.7, 3.1, 2.1, 1.67, 1.29, 1.0, 0.84, 0.67, 0.6], final: 2.8, reverse: 3.3,
    tire: { grip: 1.08, radius: 0.38, width: 265 }, brake: 1.15, steerLock: 0.6, downforce: 0.1, cda: 0.62,
    sound: { pitch: 0.85, rasp: 0.4, turbo: true },
    model: { pack: 'lowpoly', node: 'Mercedes' },
  },
  {
    id: 'aoba_focale', disp: 2261, category: 'TRACTION', catJp: 'トラクション', maker: 'AOBA', name: 'AOBA FOCALE RS', jp: 'アオバ フォカーレ RS', year: 2017, price: 46000,
    desc: 'ドリフトモード付き4WDの高性能ハッチバック。後輪寄りのトルク配分で振り回して楽しい。 (3Dモデル: ProbablyNotG (CC BY 4.0))',
    drive: '4WD', split: 0.3, mass: 1530, wheelbase: 2.66, cgHeight: 0.5, weightFront: 0.6,
    body: { len: 4.38, wid: 1.81, hgt: 1.46, style: 'hatch', shape: 'hotHatch', head: 'swept', tail: 'bar', features: ['wing'] },
    engine: { type: 'TURBO4', cyl: 4, hp: 350, torque: 440, idle: 800, redline: 6800, limiter: 7000, curve: [[800, .45], [2000, .9], [3200, 1.0], [5800, .92], [7000, .75]], inertia: 0.95 },
    gears: [3.23, 2.13, 1.48, 1.11, 0.85, 0.68], final: 3.82, reverse: 3.3,
    tire: { grip: 1.07, radius: 0.33, width: 235 }, brake: 1.12, steerLock: 0.62, downforce: 0.15, cda: 0.7,
    sound: { pitch: 1.0, rasp: 0.8, turbo: true },
    model: { pack: 'lowpoly', node: 'Ford' },
  },
  {
    id: 'ryujin_scarlet', disp: 6262, category: 'HYPER', catJp: 'ハイパーカー', maker: 'RYUJIN', name: 'RYUJIN SCARLET V12', jp: 'リュウジン スカーレット V12', year: 2014, price: 150000,
    desc: '自然吸気V12とモーターを組み合わせた究極のフラッグシップ。最高峰の性能を持つ1台。 (3Dモデル: ProbablyNotG (CC BY 4.0))',
    drive: 'FR', mass: 1420, wheelbase: 2.63, cgHeight: 0.4, weightFront: 0.41,
    body: { len: 4.88, wid: 2.04, hgt: 1.2, style: 'coupe', shape: 'wedgeCoupe', head: 'slim', tail: 'round' },
    engine: { type: 'NA6', cyl: 12, hp: 720, torque: 760, idle: 1000, redline: 9000, limiter: 9250, curve: [[1000, .55], [3500, .85], [6500, .97], [8500, 1.0], [9250, .9]], inertia: 0.85 },
    gears: [3.08, 2.19, 1.63, 1.29, 1.03, 0.84, 0.69], final: 3.5, reverse: 3.3,
    tire: { grip: 1.2, radius: 0.36, width: 345 }, brake: 1.35, steerLock: 0.55, downforce: 0.55, cda: 0.6,
    sound: { pitch: 1.25, rasp: 0.85, turbo: false },
    model: { pack: 'lowpoly', node: 'Ferrari' },
  },
  {
    id: 'kurogane_highland', disp: 4395, category: 'SUV', catJp: 'SUV', maker: 'KUROGANE', name: 'KUROGANE HIGHLAND SV', jp: 'クロガネ ハイランド SV', year: 2022, price: 68000,
    desc: '大柄なボディに過給V8を積んだ高性能SUV。重さに負けない加速力が武器。 (3Dモデル: ProbablyNotG (CC BY 4.0))',
    drive: '4WD', split: 0.45, mass: 2350, wheelbase: 2.91, cgHeight: 0.62, weightFront: 0.53,
    body: { len: 4.88, wid: 1.98, hgt: 1.69, style: 'hatch', shape: 'hotHatch', head: 'slim', tail: 'bar' },
    engine: { type: 'TURBO6', cyl: 8, hp: 530, torque: 750, idle: 650, redline: 6500, limiter: 6800, curve: [[650, .55], [1800, .95], [3000, 1.0], [5500, .92], [6800, .78]], inertia: 1.25 },
    gears: [4.71, 3.14, 2.11, 1.67, 1.29, 1.0, 0.84, 0.67], final: 3.31, reverse: 3.3,
    tire: { grip: 1.02, radius: 0.38, width: 285 }, brake: 1.08, steerLock: 0.6, downforce: 0.05, cda: 0.85,
    sound: { pitch: 0.8, rasp: 0.6, turbo: true },
    model: { pack: 'lowpoly', node: 'Land_Rover' },
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

// produce effective spec from base + tune levels (v2: Lv.0-5 per part) + setup sliders
export function buildSpec(base, tune = {}, setup = {}, dress = null) {
  if (tune && !tune.v2) { // legacy/simple tune objects (CPU cars, old saves)
    const m = { engine: ['power', 'ecu'], turbo: ['intake', 'turbo'], weight: ['weight'], tires: ['tire', 'compound'], suspension: ['susp', 'camber'], brakes: ['brake'], gearbox: ['trans'] };
    const t = { v2: true }; for (const [k, ids] of Object.entries(m)) if (tune[k]) ids.forEach(id => t[id] = Math.min(5, Math.round(tune[k] * 5 / 3))); tune = t;
  }
  const s = JSON.parse(JSON.stringify(base));
  const fx = { power: 0, rev: 0, accel: 0, shift: 0, launch: 0, traction: 0, stab: 0, handling: 0, steer: 0, brake: 0, weight: 0, grip: 0, boost: 0 };
  for (const p of TUNE_PARTS_V2) {
    const lv = tune[p.id] || 0; if (!lv) continue;
    if (p.turboOnly && !base.sound.turbo) continue;
    for (const [k, v] of Object.entries(p.fx)) fx[k] += v * lv;
  }
  const pf = partEffects(dress, base);
  const powerMul = 1 + (fx.power + pf.power) / 100;
  s.engine.hp = Math.round(base.engine.hp * powerMul);
  s.engine.torque = Math.round(base.engine.torque * powerMul);
  s.engine.redline += fx.rev; s.engine.limiter += fx.rev;
  s.mass = Math.round(base.mass * (1 - fx.weight / 100) + pf.mass);
  s.tire.grip = base.tire.grip * (1 + fx.grip / 100 + pf.grip);
  s.brake = base.brake * (1 + fx.brake / 100 + pf.brake);
  s.suspensionLevel = fx.handling / 5 + pf.susp;
  s.downforce = (base.downforce || 0) + pf.downforce;
  s.cda = (base.cda || 0.68) + pf.cda;
  s.cgHeight = base.cgHeight + pf.cg;
  s.partFx = pf;          // 0..5 → tyre stiffness / load sensitivity
  s.stability = fx.stab;                         // 0..~22 → yaw damping in slides
  s.traction = fx.traction;                      // 0..5 → keeps rear lateral grip under wheelspin
  s.steerResp = fx.steer;                        // 0..5 → steering speed
  s.launch = fx.launch;                          // 0..5 → clutch launch revs
  s.boostRate = 1 + fx.boost * 0.15;
  s.gears = base.gears.slice();
  s.shiftTime = Math.max(0.08, 0.22 - fx.shift * 0.025);
  s.setup = {
    brakeBias: 0.62 + (setup.brakeBias || 0) * 0.08,
    steerSens: 1 + (setup.steer || 0) * 0.15,
    finalMul: 1 + (setup.final || 0) * 0.08 + fx.accel * 0.006,
    camber: (setup.camber || 0),
    stiffness: (setup.stiffness || 0),
  };
  s.final = base.final * s.setup.finalMul;
  s.tuneFx = fx;
  return s;
}

// display stats (0..10) for selection screens
export function carStats(spec) {
  const pw = spec.engine.hp / spec.mass * 1000; // hp per tonne
  const top = topSpeedKmh(spec);
  const c = (v) => Math.max(0.3, Math.min(10, v));
  return {
    power: c(pw / 26),
    speed: c((top - 150) / 14),
    handling: c((spec.tire.grip * 6) + (1400 - spec.mass) / 350 + (spec.drive === 'FR' ? 0.5 : 0) + (spec.suspensionLevel || 0) * 0.5),
    accel: c(pw / 24 + (spec.drive === '4WD' ? 1.4 : 0) + (spec.tuneFx?.accel || 0) * 0.04),
    brake: c(spec.brake * 7 + (1400 - spec.mass) / 400),
    stability: c(4 + (spec.drive === '4WD' ? 2 : spec.drive === 'FF' ? 1.5 : 0) + (spec.stability || 0) * 0.22 + (spec.downforce || 0) * 4),
    grip: c(spec.tire.grip * 7.5 - 1.5),
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
