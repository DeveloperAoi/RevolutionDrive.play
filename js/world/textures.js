// Procedural canvas textures (all original, generated at runtime)
import * as THREE from 'three';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const cache = {};
function tex(c, repeat = true, aniso = 8) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = aniso;
  return t;
}

// road: u across (0..1), v along (one tile = 16 m)
export function roadTexture(wet = false) {
  const key = 'road' + wet; if (cache[key]) return cache[key];
  const [c, g] = canvas(512, 1024);
  const r = rand(7);
  g.fillStyle = wet ? '#2a2c30' : '#3a3c40'; g.fillRect(0, 0, 512, 1024);
  // aggregate noise
  const img = g.getImageData(0, 0, 512, 1024), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 34 + (r() < 0.02 ? 30 : 0);
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.05;
  }
  g.putImageData(img, 0, 0);
  // patches / repairs
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(${20 + r() * 20},${20 + r() * 20},${24 + r() * 20},${0.25 + r() * 0.3})`;
    g.fillRect(r() * 512, r() * 1024, 30 + r() * 140, 20 + r() * 160);
  }
  // tyre tracks (darker bands)
  g.fillStyle = 'rgba(10,10,12,0.22)';
  [0.27, 0.38, 0.62, 0.73].forEach(u => g.fillRect(u * 512 - 18, 0, 36, 1024));
  // skid marks
  g.strokeStyle = 'rgba(8,8,8,0.35)'; g.lineWidth = 9;
  for (let i = 0; i < 4; i++) { g.beginPath(); const x = 120 + r() * 270; g.moveTo(x, r() * 1024); g.bezierCurveTo(x + 40, 300, x - 40, 600, x + r() * 60, 1024); g.stroke(); }
  // edge lines (white, solid)
  g.fillStyle = '#e8e8e2';
  g.fillRect(14, 0, 14, 1024); g.fillRect(512 - 28, 0, 14, 1024);
  // centre line (double yellow-orange: no passing on touge)
  g.fillStyle = '#e8a417';
  g.fillRect(249, 0, 6, 1024); g.fillRect(259, 0, 6, 1024);
  // wear on the paint
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.5})`; g.fillRect(r() * 512, r() * 1024, 2 + r() * 4, 2 + r() * 4); }
  g.globalCompositeOperation = 'source-over';
  // repaint base under erased pixels
  const [c2, g2] = canvas(512, 1024); g2.fillStyle = wet ? '#2a2c30' : '#3a3c40'; g2.fillRect(0, 0, 512, 1024); g2.drawImage(c, 0, 0);
  return (cache[key] = tex(c2));
}

export function roughTexture() {
  if (cache.rough) return cache.rough;
  const [c, g] = canvas(256, 256); const r = rand(3);
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const v = 150 + r() * 105; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return (cache.rough = t);
}

export function gravelTexture() {
  if (cache.gravel) return cache.gravel;
  const [c, g] = canvas(256, 256); const r = rand(11);
  g.fillStyle = '#4a4438'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) { const v = 50 + r() * 70; g.fillStyle = `rgb(${v + 10},${v + 4},${v - 6})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3); }
  return (cache.gravel = tex(c));
}

export function terrainTexture(kind = 'forest') {
  const key = 'terrain' + kind; if (cache[key]) return cache[key];
  const [c, g] = canvas(512, 512); const r = rand(kind === 'forest' ? 5 : 9);
  const base = kind === 'forest' ? [38, 52, 30] : kind === 'rock' ? [70, 66, 60] : [74, 80, 46];
  g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const k = r();
    g.fillStyle = `rgba(${base[0] + (k - .5) * 50},${base[1] + (k - .5) * 50},${base[2] + (k - .5) * 40},0.6)`;
    g.fillRect(r() * 512, r() * 512, 2 + r() * 6, 2 + r() * 6);
  }
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(90,86,78,${0.2 + r() * 0.3})`; g.beginPath(); g.ellipse(r() * 512, r() * 512, 6 + r() * 26, 4 + r() * 14, r() * 3, 0, 7); g.fill(); }
  return (cache[key] = tex(c));
}

export function rockTexture() {
  if (cache.rock) return cache.rock;
  const [c, g] = canvas(512, 256); const r = rand(21);
  g.fillStyle = '#5b5852'; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 500; i++) {
    const v = 60 + r() * 60; g.fillStyle = `rgba(${v},${v - 2},${v - 6},0.7)`;
    g.beginPath(); const x = r() * 512, y = r() * 256; g.moveTo(x, y);
    for (let k = 0; k < 5; k++) g.lineTo(x + (r() - .5) * 50, y + (r() - .5) * 30); g.fill();
  }
  // concrete retaining wall grid lines (typical Japanese mountain roads)
  g.strokeStyle = 'rgba(40,40,40,0.5)'; g.lineWidth = 3;
  for (let x = 0; x <= 512; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  for (let y = 0; y <= 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  return (cache.rock = tex(c));
}

export function tunnelTexture() {
  if (cache.tunnel) return cache.tunnel;
  const [c, g] = canvas(256, 256); const r = rand(31);
  g.fillStyle = '#6e6a62'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) { const v = 90 + r() * 40; g.fillStyle = `rgba(${v},${v - 3},${v - 8},0.5)`; g.fillRect(r() * 256, r() * 256, 2, 2); }
  g.fillStyle = 'rgba(30,30,30,0.6)'; g.fillRect(0, 0, 256, 4); g.fillRect(0, 128, 256, 3);
  g.fillStyle = 'rgba(20,20,20,0.35)'; for (let i = 0; i < 12; i++) g.fillRect(r() * 256, r() * 256, 2, 30 + r() * 60);
  return (cache.tunnel = tex(c));
}

export function chevronTexture(dir = 1) {
  const key = 'chev' + dir; if (cache[key]) return cache[key];
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#111'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#ffcc00';
  for (let i = 0; i < 3; i++) {
    const x0 = 30 + i * 70;
    g.beginPath();
    if (dir > 0) { g.moveTo(x0 + 40, 14); g.lineTo(x0, 64); g.lineTo(x0 + 40, 114); g.lineTo(x0 + 62, 114); g.lineTo(x0 + 22, 64); g.lineTo(x0 + 62, 14); }
    else { g.moveTo(x0 + 22, 14); g.lineTo(x0 + 62, 64); g.lineTo(x0 + 22, 114); g.lineTo(x0, 114); g.lineTo(x0 + 40, 64); g.lineTo(x0, 14); }
    g.fill();
  }
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 122);
  return (cache[key] = tex(c, false));
}

export function signTexture(text, sub = '', bg = '#1a5fd0') {
  const [c, g] = canvas(512, 256);
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(12, 12, 488, 232);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 86px "Arial Black", Impact, sans-serif'; g.fillText(text, 256, sub ? 104 : 128);
  if (sub) { g.font = 'bold 40px sans-serif'; g.fillText(sub, 256, 190); }
  return tex(c, false);
}

export function bannerTexture(text, color = '#ff7a00') {
  const [c, g] = canvas(1024, 160);
  const grd = g.createLinearGradient(0, 0, 0, 160); grd.addColorStop(0, '#222'); grd.addColorStop(1, '#050505');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 160);
  g.fillStyle = color; g.fillRect(0, 0, 1024, 10); g.fillRect(0, 150, 1024, 10);
  // checkered ends
  for (let x = 0; x < 6; x++) for (let y = 0; y < 7; y++) { if ((x + y) % 2) continue; g.fillStyle = '#fff'; g.fillRect(x * 20 + 10, y * 20 + 10, 20, 20); g.fillRect(1024 - 130 + x * 20, y * 20 + 10, 20, 20); }
  g.fillStyle = '#fff'; g.font = 'italic 900 100px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 512, 84);
  return tex(c, false);
}

export function checkerTexture() {
  if (cache.checker) return cache.checker;
  const [c, g] = canvas(256, 64);
  for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#eee'; g.fillRect(x * 16, y * 16, 16, 16); }
  return (cache.checker = tex(c, false));
}

export function glowTexture(inner = 'rgba(255,240,200,1)', outer = 'rgba(255,170,60,0)') {
  const key = 'glow' + inner + outer; if (cache[key]) return cache[key];
  const [c, g] = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner); grd.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.6)')); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (cache[key] = t);
}

export function mountainTexture(color = '#0b1226', seed = 1, peaks = 1) {
  const [c, g] = canvas(2048, 256); const r = rand(seed);
  g.clearRect(0, 0, 2048, 256);
  g.fillStyle = color; g.beginPath(); g.moveTo(0, 256);
  let y = 150;
  for (let x = 0; x <= 2048; x += 16) {
    y += (r() - 0.5) * 26 * peaks; y = Math.max(40, Math.min(220, y));
    // wrap smoothly
    const t = x / 2048; const yy = t > 0.9 ? y + (150 - y) * ((t - 0.9) / 0.1) : y;
    g.lineTo(x, yy);
  }
  g.lineTo(2048, 256); g.closePath(); g.fill();
  // distant town lights
  if (seed % 2 === 0) for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,${180 + r() * 60},${100 + r() * 80},${0.5 + r() * 0.5})`; g.fillRect(r() * 2048, 225 + r() * 30, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}

export function carbonTexture() {
  if (cache.carbon) return cache.carbon;
  const [c, g] = canvas(64, 64);
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) { g.fillStyle = (x + y) % 2 ? '#1a1a1c' : '#2a2a2e'; g.fillRect(x * 8, y * 8, 8, 8); }
  return (cache.carbon = tex(c));
}

export function plateTexture(text = 'RD 86-01') {
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#f4f4ee'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#2a6a2a'; g.lineWidth = 6; g.strokeRect(4, 4, 248, 120);
  g.fillStyle = '#1d4f1d'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 28px sans-serif'; g.fillText('REVOLUTION', 128, 32);
  g.font = 'bold 54px "Arial Black", sans-serif'; g.fillText(text.slice(0, 8), 128, 86);
  return tex(c, false, 2);
}

export function meshTexture() {
  const key = 'mesh'; if (cache[key]) return cache[key];
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#050505'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#3a3a3a'; g.lineWidth = 2;
  for (let i = -64; i < 128; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 1); t.colorSpace = THREE.SRGBColorSpace;
  return (cache[key] = t);
}

export function cloudTexture(seed = 0) {
  const key = 'cloud' + seed; if (cache[key]) return cache[key];
  const [c, g] = canvas(256, 128);
  let a = seed * 9301 + 49297; const rnd = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
  for (let k = 0; k < 34; k++) {
    const x = 40 + rnd() * 176, y = 50 + rnd() * 40 - Math.abs(x - 128) * 0.12, r = 18 + rnd() * 30;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const sh = 225 + Math.floor((y / 128) * -30 + rnd() * 20);
    grd.addColorStop(0, `rgba(${sh},${sh},${sh + 8},0.55)`); grd.addColorStop(1, `rgba(${sh},${sh},${sh + 8},0)`);
    g.fillStyle = grd; g.fillRect(0, 0, 256, 128);
  }
  // flat grey bottom
  const fade = g.createLinearGradient(0, 70, 0, 128); fade.addColorStop(0, 'rgba(160,170,185,0)'); fade.addColorStop(1, 'rgba(160,170,185,0.25)');
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = fade; g.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (cache[key] = t);
}
