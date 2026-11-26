// REVOLUTION DRIVE — accessories (cups, titles, special paints) + customize tokens / points + rewards
// Customize tokens (CT) are earned by playing (story gives a lot); every 100 CT = 1 customize point (CP).
// Accessories are bought with CP only in the SHOP, or received as rewards (報酬).
export const TOKENS_PER_POINT = 100;

export const ACC_CATS = [
  { id: 'cup', jp: 'カップ', en: 'Cup Customize', title: 'CUP CUSTOMIZE', ask: '紙コップを選んでください', now: '現在使用中のカップ' },
  { id: 'title', jp: '称号', en: 'Title', title: 'TITLE CUSTOMIZE', ask: '称号を選んでください', now: '現在使用中の称号' },
  { id: 'spcolor', jp: 'ボディカラーSP', en: 'Special Paint', title: 'SP COLOR', ask: 'スペシャルカラーを選んでください', now: '購入済みのSPカラーはドレスアップで使えます' },
];

// cups sit in the race HUD; the liquid sloshes with the car's g-forces (spill = sloppy driving)
export const ACCESSORIES = [
  { id: 'cup_paper', cat: 'cup', name: '紙コップ(通常)', cost: 1, liquid: '#2a6ad0', cup: '#f2f2f2', holder: 'carbon' },
  { id: 'cup_coffee', cat: 'cup', name: 'コーヒーカップ', cost: 2, liquid: '#5a3416', cup: '#f6efe2', holder: 'carbon' },
  { id: 'cup_tea', cat: 'cup', name: '湯のみ(緑茶)', cost: 2, liquid: '#8ab040', cup: '#3a5a3a', holder: 'wood' },
  { id: 'cup_soda', cat: 'cup', name: 'ソーダ(メロン)', cost: 3, liquid: '#3ae070', cup: '#d8f0ff', holder: 'carbon' },
  { id: 'cup_tofu', cat: 'cup', name: '木の升(水)', cost: 3, liquid: '#9ad4ff', cup: '#d8b070', holder: 'wood' },
  { id: 'cup_gold', cat: 'cup', name: '黄金のカップ', cost: 8, liquid: '#ffd400', cup: '#e0b020', holder: 'gold' },
  { id: 't_rookie', cat: 'title', name: '峠のルーキー', cost: 1 },
  { id: 't_nightrun', cat: 'title', name: '夜を駆ける者', cost: 2 },
  { id: 't_drift', cat: 'title', name: 'ドリフトの申し子', cost: 3 },
  { id: 't_hairpin', cat: 'title', name: 'ヘアピンマスター', cost: 3 },
  { id: 't_legend', cat: 'title', name: '伝説の走り屋', cost: 10 },
  { id: 't_akane', cat: 'title', name: '赤嶺の新星', reward: true },
  { id: 't_shiranami', cat: 'title', name: '白波を制す者', reward: true },
  { id: 't_kasumi', cat: 'title', name: '霧を晴らす者', reward: true },
  { id: 't_ryusei', cat: 'title', name: '流星の頂点', reward: true },
  { id: 't_online10', cat: 'title', name: '対戦初心者', reward: true },
  { id: 't_win10', cat: 'title', name: '勝利を追い続ける者', reward: true },
  { id: 'sp_sakura', cat: 'spcolor', name: 'SP サクラ', cost: 3, hex: '#f2a8c8', finish: 'pearl' },
  { id: 'sp_midori', cat: 'spcolor', name: 'SP ミドリ', cost: 3, hex: '#1ad070', finish: 'pearl' },
  { id: 'sp_sora', cat: 'spcolor', name: 'SP ソラ', cost: 3, hex: '#5ac8ff', finish: 'pearl' },
  { id: 'sp_kurenai', cat: 'spcolor', name: 'SP クレナイ', cost: 4, hex: '#a00a1e', finish: 'pearl' },
  { id: 'sp_gold', cat: 'spcolor', name: 'SP ゴールド', cost: 6, hex: '#d8a820', finish: 'metallic' },
  { id: 'sp_ryusei', cat: 'spcolor', name: 'SP 流星ブルー', reward: true, hex: '#2030c0', finish: 'pearl' },
];
export const accById = (id) => ACCESSORIES.find(a => a.id === id);

// ---- profile helpers ----
export function accState(p) {
  p.acc ||= { owned: {}, eq: {}, ct: 0, cp: 0, pending: [] };
  return p.acc;
}
export const owns = (p, id) => !!accState(p).owned[id];
// add customize tokens; converts every 100 into 1 point. returns points gained
export function addTokens(p, n) {
  const a = accState(p); a.ct += Math.max(0, Math.round(n));
  const gained = Math.floor(a.ct / TOKENS_PER_POINT); a.ct -= gained * TOKENS_PER_POINT; a.cp += gained;
  return gained;
}
// grant a reward (accessory, or credits when already owned — "converted to cash")
export function grantReward(p, id, why) {
  const a = accState(p), it = accById(id); if (!it) return;
  if (a.owned[id]) { p.credits += 500; a.pending.push({ id, why, cash: 500 }); return; }
  a.owned[id] = true; a.pending.push({ id, why });
}
// achievement checks run after every race; push rewards for newly reached milestones
export function checkRewards(p) {
  const st = p.stats || {}, story = p.story || { cleared: {} }, a = accState(p);
  const rules = [
    ['t_akane', () => ['a1e1', 'a1e2', 'a1e3', 'a1e4'].every(e => story.cleared[e]), 'ストーリー「赤嶺の新星編」をクリアした!'],
    ['t_shiranami', () => ['a2e1', 'a2e2', 'a2e3', 'a2e4'].every(e => story.cleared[e]), 'ストーリー「白波の稲妻編」をクリアした!'],
    ['t_kasumi', () => ['a3e1', 'a3e2', 'a3e3', 'a3e4'].every(e => story.cleared[e]), 'ストーリー「霞湖の亡霊編」をクリアした!'],
    ['t_ryusei', () => ['a4e1', 'a4e2', 'a4e3', 'a4e4'].every(e => story.cleared[e]), 'SEASON 1 をすべてクリアした!'],
    ['sp_ryusei', () => story.cleared.a4e4, '流星の王に勝利した!'],
    ['t_online10', () => (st.online || 0) >= 10, 'オンラインバトルを10回プレイした!'],
    ['t_win10', () => (st.onlineWins || 0) >= 10, 'オンラインバトルで10回勝利した!'],
    ['cup_paper', () => (st.races || 0) >= 1, '初めてのレースを走った!'],
    ['t_rookie', () => (st.races || 0) >= 5, 'レースを5回走った!'],
  ];
  a.done ||= {};
  for (const [id, ok, why] of rules) if (!a.done[id] && ok()) { a.done[id] = true; grantReward(p, id, why); }
}

// ---- artwork ----
export function cupSVG(it, size = 120, level = 1) {
  if (!it) return `<svg viewBox="0 0 100 100" width="${size}" height="${size}"><text x="50" y="58" text-anchor="middle" font-size="16" fill="#888" font-family="Arial">NONE</text></svg>`;
  const hold = it.holder === 'wood' ? '#7a5030' : it.holder === 'gold' ? '#b08a20' : '#1a1a1c';
  const lv = 30 + (1 - level) * 10;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}"><defs><pattern id="cb${it.id}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${hold}"/><rect width="3" height="3" fill="rgba(255,255,255,.12)"/><rect x="3" y="3" width="3" height="3" fill="rgba(255,255,255,.12)"/></pattern></defs>
    <path d="M18 62 H82 L78 90 C70 96 30 96 22 90Z" fill="url(#cb${it.id})" stroke="#000" stroke-width="2"/>
    <path d="M24 14 H76 L70 70 C64 74 36 74 30 70Z" fill="${it.cup}" stroke="#555" stroke-width="2"/>
    <ellipse cx="50" cy="14" rx="26" ry="7" fill="${it.cup}" stroke="#666" stroke-width="2"/>
    <ellipse cx="50" cy="${16 + (lv - 30) * 0.3}" rx="23" ry="5.5" fill="${it.liquid}"/><ellipse cx="44" cy="${15 + (lv - 30) * 0.3}" rx="8" ry="1.6" fill="rgba(255,255,255,.5)"/></svg>`;
}
export function titleSVG(it, w = 220) {
  return `<svg viewBox="0 0 220 60" width="${w}" height="${w * 60 / 220}"><defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6a0"/><stop offset=".5" stop-color="#e0b020"/><stop offset="1" stop-color="#8a6000"/></linearGradient></defs>
    <path d="M10 8 H210 L200 52 H20Z" fill="url(#tg)" stroke="#3a2a00" stroke-width="2"/><path d="M22 14 H198 L191 46 H29Z" fill="#1a1a1c"/>
    <text x="110" y="37" text-anchor="middle" font-family="Noto Sans JP, sans-serif" font-weight="900" font-size="${it && it.name.length > 8 ? 15 : 19}" fill="#ffd400">${it ? it.name : '称号なし'}</text></svg>`;
}
export function paintSVG(it, size = 120) {
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}"><ellipse cx="50" cy="84" rx="40" ry="8" fill="#444"/><path d="M14 74 C14 64 22 60 32 58 L42 46 L66 46 L76 58 C84 60 88 64 88 74Z" fill="${it.hex}" stroke="#222" stroke-width="2"/><path d="M44 50 L64 50 L70 58 L40 58Z" fill="#9ab"/><circle cx="30" cy="76" r="7" fill="#111"/><circle cx="72" cy="76" r="7" fill="#111"/>
    <path d="M58 6 L80 6 L80 30 L58 30Z" fill="#999" stroke="#333" stroke-width="2"/><path d="M60 14 L78 14 L78 28 L60 28Z" fill="${it.hex}"/><path d="M66 30 C64 38 70 40 69 46" stroke="${it.hex}" stroke-width="4" fill="none"/></svg>`;
}
export function accIcon(it, size = 110) {
  if (!it) return cupSVG(null, size);
  return it.cat === 'cup' ? cupSVG(it, size) : it.cat === 'title' ? titleSVG(it, size * 1.6) : paintSVG(it, size);
}
