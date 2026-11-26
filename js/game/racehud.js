// REVOLUTION DRIVE — in-race HUD (reference-style layout, original artwork)
// Everything shown here is read from the live race/vehicle state each frame.
import * as THREE from 'three';
import { Tacho, fmt, fmtDelta } from './hud.js';
import { avatarSVG, rankBadge, esc } from '../ui/core.js';
import { Audio } from '../audio/audio.js';

const $ = (s, r) => r.querySelector(s);

// corner warning sign (original diamond pictograms)
function signSVG(kind, dir, size = 120) {
  const col = kind === 'hairpin' ? ['#d8202a', '#fff'] : kind === 'sharp' ? ['#f2a400', '#111'] : ['#2a9a3a', '#fff'];
  const flip = dir > 0 ? '' : 'transform="translate(100,0) scale(-1,1)"'; // icons drawn as LEFT turns
  const icon = kind === 'hairpin'
    ? `<path d="M64 74 V44 a14 14 0 0 0 -28 0 V58" fill="none" stroke="${col[1]}" stroke-width="10" stroke-linecap="round"/><path d="M24 54 L36 70 L48 54Z" fill="${col[1]}"/>`
    : kind === 'sharp'
      ? `<path d="M60 76 V50 L40 38" fill="none" stroke="${col[1]}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 28 L46 30 L38 44Z" fill="${col[1]}"/>`
      : `<path d="M58 76 C58 56 52 46 40 36" fill="none" stroke="${col[1]}" stroke-width="10" stroke-linecap="round"/><path d="M30 26 L48 30 L38 44Z" fill="${col[1]}"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100"><g filter="url(#sgl)"><rect x="18" y="18" width="64" height="64" rx="6" transform="rotate(45 50 50)" fill="#fff" stroke="#222" stroke-width="3"/><rect x="23" y="23" width="54" height="54" rx="4" transform="rotate(45 50 50)" fill="${col[0]}"/></g><g ${flip}>${icon}</g></svg>`;
}

// classify upcoming corners from track curvature
export function cornersAhead(track, s, range = 260) {
  const out = []; const TH = 0.011;
  let d = 0;
  while (d < range && out.length < 2) {
    const k = track.pointAt(s + d).k;
    if (Math.abs(k) > TH) {
      let ang = 0, e = d; const sg = Math.sign(k);
      while (e < d + 400) { const kk = track.pointAt(s + e).k; if (Math.abs(kk) < TH * 0.6 || Math.sign(kk) !== sg) break; ang += kk * 4; e += 4; }
      const deg = Math.abs(ang) * 57.3;
      if (deg > 25) out.push({ dist: d, dir: sg, kind: deg > 130 ? 'hairpin' : deg > 70 ? 'sharp' : 'curve', deg, len: e - d });
      d = e + 8;
    } else d += 4;
  }
  return out;
}

export class RaceHUD {
  constructor(root, race) {
    this.root = root; this.race = race;
    const cfg = race.cfg; const P = cfg.playerInfo || {};
    const mode = cfg.mode;
    root.classList.toggle('m-battle', mode === 'battle');
    root.classList.toggle('m-trial', mode !== 'battle');
    const course = race.def;
    // mode band + player panel
    $('.rh-band', root).innerHTML = mode === 'battle'
      ? `<b class="pos"><span class="rh-pos">1</span><small>/${race.cars.length}</small></b><span class="lbl">コースバトル</span>`
      : `<span class="lbl">${cfg.event ? 'スペシャル' : 'タイムトライアル'}</span>`;
    $('.rh-player', root).innerHTML = `<div class="av">${avatarSVG(P.icon || 0, 150)}</div><div class="rk">${rankBadge(P.rp || 0, 92)}</div>
      <div class="nm"><b>${esc(P.name || 'DRIVER')}</b><small>${esc(P.carName || '')}</small></div><div class="tm">${esc(P.team || '')}</div>`;
    // rivals (battle)
    const rivals = race.cars.filter(c => c !== race.player);
    $('.rh-rivals', root).innerHTML = mode === 'battle' ? rivals.map((c, i) => `<div class="rv" data-i="${i}"><div class="av">${avatarSVG(c.icon ?? (i + 2), 110)}</div><div class="rk">${rankBadge(c.rp || 0, 70)}</div><div class="nm"><b>${esc(c.name || 'RIVAL')}</b><small>${esc(c.carName || '')}</small></div><div class="adv">ADVANTAGE <b>--</b></div></div>`).join('') : '';
    // float tags for rivals
    $('.rh-tags', root).innerHTML = rivals.map((c, i) => `<div class="tag" data-i="${i}"><b>2</b>${esc(c.name || 'RIVAL')}</div>`).join('');
    // time panel (trial)
    const nSec = race.track.sections.length * race.laps + (race.laps - 1) + 1;
    this.nSec = nSec;
    $('.rh-time', root).innerHTML = `<div class="tt"><span>Total Time</span><b class="rh-total">0'00"000</b></div>
      <div class="st"><span>Section Time</span><div class="rh-secs"></div></div>
      ${mode !== 'battle' ? `<div class="pb"><span>自己ベスト</span><b class="rh-pb">${fmt(cfg.best?.best)}</b></div><div class="pbd rh-pbd"></div>
      <div class="tg"><span class="tier">◀ <i class="rh-tier">ROOKIE</i> ▶</span><b class="rh-target"></b></div><div class="pbd rh-tgd"></div>
      <div class="gh rh-ghost"></div>` : `<div class="pb"><span>BATTLE TIME</span><b class="rh-bt">0'00"000</b></div>`}`;
    this.targets = targetTimes(race);
    const tierEl = $('.rh-time .tier', root);
    if (tierEl) tierEl.onclick = () => { this.ti = (this.ti + 1) % this.targets.length; this.drawTarget(); };
    this.ti = this.targets.length - 1; this.drawTarget();
    // minimap
    this.mm = $('.rh-mm canvas', root); this.mmg = this.mm.getContext('2d'); this.mm.width = this.mm.height = 360;
    $('.rh-mm .cn', root).textContent = `${course.jp}・${course.dirs[race.cfg.dir || 'fwd'][1]}`;
    // meter
    this.tacho = new Tacho($('.rh-meter canvas', root), cfg.meter);
    this.onoW = 0; this.lastSec = -1;
    this.renderSecs();
    this.updToggles();
    $('.rh-tg-ghost', root).onclick = () => this.race.toggleGhost();
    $('.rh-tg-line', root).onclick = () => this.race.toggleLine();
    this.tmpV = new THREE.Vector3();
  }
  drawTarget() {
    const t = this.targets[this.ti]; if (!t || !$('.rh-tier', this.root)) return;
    $('.rh-tier', this.root).textContent = t.name; $('.rh-target', this.root).textContent = fmt(t.time);
  }
  updToggles() {
    const r = this.race;
    const set = (sel, on, avail = true) => { const n = $(sel, this.root); n.querySelector('b').textContent = !avail ? '—' : on ? 'ON' : 'OFF'; n.classList.toggle('on', on && avail); };
    set('.rh-tg-ghost', r.ghostOn, !!r.ghost); set('.rh-tg-line', r.lineOn);
    $('.rh-tg-ghost', this.root).style.display = r.cfg.mode === 'battle' ? 'none' : '';
  }
  renderSecs() {
    const r = this.race; let h = '';
    for (let i = 0; i < this.nSec; i++) {
      const t = r.sections[i]; const prev = i ? r.sections[i - 1] : 0;
      const split = t != null ? t - prev : null;
      const b = r.cfg.best?.sections; const bs = b && b[i] != null ? b[i] - (i ? b[i - 1] : 0) : null;
      const cls = split == null ? 'pend' : bs == null ? '' : split <= bs ? 'fast' : 'slow';
      h += `<div class="${cls}"><i>${i + 1}</i><b>${split != null ? fmt(split) : '-\'--"---'}</b></div>`;
    }
    $('.rh-secs', this.root).innerHTML = h;
  }
  sectionPopup(idx, split, delta) {
    const el = $('.rh-secpop', this.root);
    el.innerHTML = `<span>SECTION ${idx}</span><b>${fmt(split)}</b>${delta != null ? `<em class="${delta <= 0 ? 'fast' : 'slow'}">${fmtDelta(delta)}</em>` : ''}${delta != null && delta <= 0 ? '<i>SECTION BEST!</i>' : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    this.renderSecs();
  }
  // screen projection of a world point into stage coordinates
  toStage(v3, cam) {
    const p = this.tmpV.copy(v3).project(cam);
    if (p.z > 1) return null;
    const st = document.getElementById('stage').getBoundingClientRect();
    const sx = (p.x + 1) / 2 * innerWidth, sy = (1 - p.y) / 2 * innerHeight;
    const k = st.width / 1920;
    return [(sx - st.left) / k, (sy - st.top) / k];
  }
  update(dt) {
    const r = this.race, p = r.player; if (!p) return;
    const v = p.veh, root = this.root;
    const t = r.state === 'countdown' ? 0 : (p.finished ? (p.finishTime ?? r.raceTime) : r.raceTime);
    $('.rh-total', root).textContent = fmt(t);
    // live current-section time
    const prev = r.sections.length ? r.sections[r.sections.length - 1] : 0;
    const curRow = $('.rh-secs', root).children[r.sections.length];
    if (curRow && !p.finished && r.state === 'race') curRow.querySelector('b').textContent = fmt(t - prev), curRow.className = 'cur';
    // personal best / target deltas from ghost or section splits
    if (r.cfg.mode !== 'battle') {
      const gd = r.ghostDelta;
      const pbd = $('.rh-pbd', root);
      if (gd != null) { pbd.textContent = fmtDelta(gd); pbd.className = 'pbd rh-pbd ' + (gd <= 0 ? 'fast' : 'slow'); }
      else pbd.textContent = r.cfg.best ? '' : '-\'--"---';
      const tg = this.targets[this.ti]; const tgd = $('.rh-tgd', root);
      if (tg) { const est = r.raceTime / Math.max(0.01, p.prog / r.totalLen); const d = p.prog > 80 ? est - tg.time : null; tgd.textContent = d == null ? '-\'--"---' : fmtDelta(d); tgd.className = 'pbd rh-tgd ' + (d != null && d <= 0 ? 'fast' : 'slow'); }
      const gh = $('.rh-ghost', root);
      gh.innerHTML = r.ghost ? (r.ghostOn ? `GHOST <b class="${r.ghostGap >= 0 ? 'fast' : 'slow'}">${r.ghostGap >= 0 ? '+' : ''}${(r.ghostGap ?? 0).toFixed(1)}m</b>` : 'GHOST OFF') : 'GHOST — 記録なし';
    } else {
      $('.rh-bt', root).textContent = fmt(t);
      const pos = r.positionOf(p); $('.rh-pos', root).textContent = pos;
      r.cars.filter(c => c !== p).forEach((c, i) => {
        const adv = p.prog - c.prog;
        const n = root.querySelector(`.rv[data-i="${i}"] .adv`);
        if (n) { n.innerHTML = `ADVANTAGE <b class="${adv >= 0 ? 'lead' : 'behind'}">${adv >= 0 ? '+' : ''}${adv.toFixed(1)}m</b>`; }
      });
    }
    // floating rival tags
    r.cars.filter(c => c !== p).forEach((c, i) => {
      const tag = root.querySelector(`.rh-tags .tag[data-i="${i}"]`); if (!tag) return;
      const w = new THREE.Vector3(c.veh.x, c.surfY + 2.0, c.veh.z);
      const d = w.distanceTo(r.camera.position);
      const s = d < 140 ? this.toStage(w, r.camera) : null;
      if (!s) { tag.style.display = 'none'; return; }
      tag.style.display = ''; tag.style.transform = `translate(${s[0]}px, ${s[1]}px) translate(-50%,-100%) scale(${Math.max(0.55, Math.min(1.1, 18 / d))})`;
      tag.querySelector('b').textContent = r.positionOf(c);
    });
    // corner signs
    const cs = r.state === 'race' || r.state === 'countdown' ? cornersAhead(r.track, ((p.prog % r.track.length) + r.track.length) % r.track.length) : [];
    const sg = $('.rh-sign', root);
    const key = cs.map(c => c.kind + c.dir).join('|') + (cs[0] && cs[0].dist < 170 ? 'v' : '');
    if (key !== this.signKey) {
      this.signKey = key;
      sg.innerHTML = cs[0] && cs[0].dist < 170 ? `${cs[1] ? `<div class="nx">${signSVG(cs[1].kind, cs[1].dir, 56)}</div>` : ''}<div class="mn">${signSVG(cs[0].kind, cs[0].dir, 130)}</div>` : '';
    }
    sg.classList.toggle('near', !!(cs[0] && cs[0].dist < 60));
    // guide SE, synchronised with the sign animation
    const shown = cs[0] && cs[0].dist < 170 ? cs[0] : null;
    if (r.state === 'race' && key !== this.seKey) {
      const prevMain = this.seMain;
      if (shown) {
        const chain = cs[1] && cs[1].dist - (shown.dist + shown.len) < 70;
        if (!prevMain || prevMain.dist < shown.dist - 40 || prevMain.kind !== shown.kind || prevMain.dir !== shown.dir) {
          if (prevMain && prevMain.dir !== shown.dir && prevMain.dist < 30) Audio.guideSE('switch', -shown.dir);
          Audio.guideSE(shown.kind, -shown.dir);
          if (chain) setTimeout(() => Audio.guideSE('chain', -shown.dir), 180);
          sg.classList.toggle('chain', !!chain);
        } else Audio.guideSE('update', -shown.dir);
      }
      this.seMain = shown; this.seKey = key;
    }
    // slope indicator (uphill / downhill ahead)
    const sNow = ((p.prog % r.track.length) + r.track.length) % r.track.length;
    const g = (r.track.pointAt(sNow + 90).y - r.track.pointAt(sNow + 20).y) / 70;
    const slope = g > 0.055 ? 'up' : g < -0.055 ? 'down' : null;
    if (slope !== this.slope) {
      this.slope = slope;
      const sl = $('.rh-slope', root);
      sl.innerHTML = slope ? `<b>${slope === 'up' ? '⬈ 上り' : '⬊ 下り'}</b><span>${Math.round(Math.abs(g) * 100)}%</span>` : '';
      sl.className = 'rh-slope ' + (slope || '');
      if (slope && r.state === 'race') Audio.guideSE(slope);
    }
    // minimap (rotates with heading)
    this.drawMap(p);
    const remain = Math.max(0, r.totalLen - p.prog) / 1000;
    $('.rh-mm .rem', root).innerHTML = `残り<b>${remain.toFixed(1)}</b>km`;
    // shift pattern & condition
    const gearEl = $('.rh-gear', root);
    gearEl.innerHTML = gearPattern(v, r.autoGear);
    const cond = Math.round(p.condition ?? 100);
    $('.rh-cond', root).innerHTML = `<span>CONDITION</span><b style="color:${cond > 70 ? '#3dff8a' : cond > 40 ? '#ffd400' : '#ff4040'}">${cond}%</b>`;
    // inputs
    const inp = r.lastInput || { throttle: 0, brake: 0, steer: 0 };
    $('.rh-in .th i', root).style.height = (inp.throttle * 100) + '%';
    $('.rh-in .br i', root).style.height = (inp.brake * 100) + '%';
    $('.rh-in .sw i', root).style.left = (50 + inp.steer * 45) + '%';
    // meter
    this.tacho.draw(v, v.spec, v.kmh, { auto: r.autoGear, warn: p.wrong > 1.2 ? 'WRONG WAY' : (p.offroad ? 'COURSE OUT' : (cond < 40 ? 'DAMAGE' : null)) });
    // drift onomatopoeia
    this.onoW -= dt;
    if (r.state === 'race' && v.speed > 9 && Math.max(v.slipRear, v.slipFront) > 0.55 && this.onoW <= 0) { this.onomatopoeia(p); this.onoW = 0.32; }
    $('.rh-warn', root).style.display = p.wrong > 1.2 ? 'block' : 'none';
  }
  onomatopoeia(p) {
    const s = this.toStage(new THREE.Vector3(p.veh.x, p.surfY + 0.8, p.veh.z), this.race.camera); if (!s) return;
    const words = ['ギャアア', 'ギャギャ', 'キュアア', 'ギャァ'];
    const el = document.createElement('div'); el.className = 'ono';
    el.textContent = words[(Math.random() * words.length) | 0];
    const side = Math.random() < 0.5 ? -1 : 1;
    el.style.left = (s[0] + side * (180 + Math.random() * 120)) + 'px'; el.style.top = (s[1] - 60 - Math.random() * 80) + 'px';
    el.style.setProperty('--r', (side * (8 + Math.random() * 18)) + 'deg');
    $('.rh-onos', this.root).appendChild(el); setTimeout(() => el.remove(), 900);
  }
  drawMap(p) {
    const g = this.mmg, S = 360, R = 170, t = this.race.track, sc = 0.42; // px per metre
    const v = p.veh; const cx = S / 2, cy = S / 2 + 30;
    g.clearRect(0, 0, S, S);
    g.save(); g.beginPath(); g.arc(S / 2, S / 2, R, 0, 7); g.clip();
    g.fillStyle = 'rgba(14,20,30,.82)'; g.fillRect(0, 0, S, S);
    // grid
    g.strokeStyle = 'rgba(120,150,200,.18)'; g.lineWidth = 1;
    for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(0, S / 2 + i * 30); g.lineTo(S, S / 2 + i * 30); g.stroke(); g.beginPath(); g.moveTo(S / 2 + i * 30, 0); g.lineTo(S / 2 + i * 30, S); g.stroke(); }
    g.translate(cx, cy); g.rotate(Math.PI + v.yaw); // heading up
    const tf = (x, z) => [(x - v.x) * sc * -1, (z - v.z) * sc];
    g.beginPath();
    for (let i = 0; i < t.n; i += 2) { const [x, y] = tf(t.x[i], t.z[i]); if (i) g.lineTo(-x, y); else g.moveTo(-x, y); }
    if (t.closed) g.closePath();
    g.strokeStyle = '#000'; g.lineWidth = 10; g.lineJoin = 'round'; g.stroke();
    g.strokeStyle = '#f2f4f8'; g.lineWidth = 5; g.stroke();
    // goal
    if (!t.closed) { const e = t.pointAt(t.length); const [x, y] = tf(e.x, e.z); g.fillStyle = '#ffd400'; g.beginPath(); g.arc(-x, y, 7, 0, 7); g.fill(); }
    const dot = (x, z, col, r = 7) => { const [a, b] = tf(x, z); g.beginPath(); g.arc(-a, b, r, 0, 7); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 12; g.fill(); g.shadowBlur = 0; };
    const gh = this.race.ghost; if (gh && this.race.ghostOn && gh.model.root.visible) dot(gh.model.root.position.x, gh.model.root.position.z, '#7af0ff', 6);
    for (const c of this.race.cars) if (c !== p) dot(c.veh.x, c.veh.z, '#ff3a3a', 7);
    g.restore();
    // player marker (centre, glowing)
    g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fillStyle = '#4ac8ff'; g.shadowColor = '#4ac8ff'; g.shadowBlur = 18; g.fill(); g.shadowBlur = 0;
    g.beginPath(); g.moveTo(cx, cy - 20); g.lineTo(cx + 7, cy - 9); g.lineTo(cx - 7, cy - 9); g.closePath(); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); g.arc(S / 2, S / 2, R, 0, 7); g.lineWidth = 6; g.strokeStyle = '#2a6aa8'; g.stroke(); g.lineWidth = 2; g.strokeStyle = '#9ad0ff'; g.stroke();
  }
}

function gearPattern(v, auto) {
  const g = v.gear;
  const pos = { 1: [14, 12], 2: [14, 48], 3: [36, 12], 4: [36, 48], 5: [58, 12], 6: [58, 48], '-1': [58, 48] };
  const p = pos[g] || [36, 30];
  return `<svg viewBox="0 0 72 60" width="76" height="64"><path d="M14 12 V48 M36 12 V48 M58 12 V48 M14 30 H58" stroke="#999" stroke-width="3" fill="none"/>
    <text x="14" y="9" fill="#ccc" font-size="8" text-anchor="middle">1</text><text x="36" y="9" fill="#ccc" font-size="8" text-anchor="middle">3</text><text x="58" y="9" fill="#ccc" font-size="8" text-anchor="middle">5</text>
    <text x="14" y="58" fill="#ccc" font-size="8" text-anchor="middle">2</text><text x="36" y="58" fill="#ccc" font-size="8" text-anchor="middle">4</text><text x="58" y="58" fill="#ccc" font-size="8" text-anchor="middle">${v.spec.gears.length > 5 ? '6' : 'R'}</text>
    <circle cx="${p[0]}" cy="${p[1]}" r="8" fill="#ff7a00" stroke="#fff" stroke-width="2"/><text x="${p[0]}" y="${p[1] + 3}" font-size="9" text-anchor="middle" fill="#111" font-weight="bold">${auto ? 'AT' : (g < 0 ? 'R' : g)}</text></svg>`;
}

// target time tiers per course (derived from the real course length and the AI reference pace)
export function targetTimes(race) {
  const L = race.totalLen; const wet = race.world.grip < 1;
  const pace = [['LEGEND', 92], ['EXPERT', 82], ['PRO', 72], ['ROOKIE', 58]]; // average km/h
  return pace.map(([name, kmh]) => ({ name, time: Math.round(L / (kmh * (wet ? 0.88 : 1) / 3.6) * 1000) / 1000 }));
}
