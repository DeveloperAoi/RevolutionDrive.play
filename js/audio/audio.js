// REVOLUTION DRIVE — all audio is synthesised with the Web Audio API (no sample files).
// Engine sounds are generated per car from cylinder count / engine type, plus tyre
// squeal, impacts, gear shifts, turbo whistle and blow-off, UI blips and procedural BGM.

class AudioSys {
  constructor() { this.ctx = null; this.vol = { bgm: 0.6, sfx: 0.8 }; this.music = null; this.engines = new Set(); }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.master);
    this.bgm = ctx.createGain(); this.bgm.gain.value = this.vol.bgm * 0.55; this.bgm.connect(this.master);
    this.guide = ctx.createGain(); this.guide.gain.value = (this.vol.guide ?? 0.7) * 0.9; this.guide.connect(this.master);
    // shared noise buffer
    const len = ctx.sampleRate * 2; const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // distortion curve
    const n = 1024; this.curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / n * 2 - 1; this.curve[i] = Math.tanh(x * 2.6); }
    if (this._pendingMusic) { const m = this._pendingMusic; this._pendingMusic = null; this.playMusic(m); }
    // load the combustion-pulse engine synthesiser (falls back to oscillators if unavailable)
    if (ctx.audioWorklet) ctx.audioWorklet.addModule(new URL('./engine-worklet.js', import.meta.url)).then(() => { this.worklet = true; }).catch(e => console.warn('engine worklet unavailable', e));
  }

  setVolume(kind, v) { // v: 0..10
    this.vol[kind] = v / 10;
    if (!this.ctx) return;
    if (kind === 'bgm') this.bgm.gain.setTargetAtTime(this.vol.bgm * 0.55, this.ctx.currentTime, 0.05);
    else if (kind === 'guide') this.guide.gain.setTargetAtTime(this.vol.guide * 0.9, this.ctx.currentTime, 0.05);
    else this.sfx.gain.setTargetAtTime(this.vol.sfx, this.ctx.currentTime, 0.05);
  }

  noise() { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; return s; }

  // ---- UI sounds ----------------------------------------------------------
  blip(f = 880, dur = 0.05, type = 'square', g = 0.12, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), a = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(a).connect(this.sfx); o.start(t); o.stop(t + dur + 0.02); autoFree(o, [a]);
  }
  ui(kind) {
    if (!this.ctx) return;
    if (kind === 'move') this.blip(1320, 0.04, 'square', 0.06);
    else if (kind === 'ok') { this.blip(880, 0.07, 'square', 0.1); this.blip(1760, 0.12, 'square', 0.1, 0.06); }
    else if (kind === 'back') { this.blip(660, 0.06, 'square', 0.08); this.blip(330, 0.1, 'square', 0.08, 0.05); }
    else if (kind === 'error') { this.blip(160, 0.18, 'sawtooth', 0.12); }
    else if (kind === 'key') this.blip(2000, 0.03, 'triangle', 0.1);
    else if (kind === 'start') { [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.18, 'sawtooth', 0.08, i * 0.07)); this.whoosh(); }
    else if (kind === 'count') this.blip(880, 0.25, 'sine', 0.25);
    else if (kind === 'go') this.blip(1760, 0.7, 'sine', 0.3);
    else if (kind === 'section') { this.blip(1175, 0.1, 'sine', 0.18); this.blip(1568, 0.25, 'sine', 0.18, 0.1); }
    else if (kind === 'coin') { this.blip(1568, 0.08, 'square', 0.08); this.blip(2093, 0.25, 'square', 0.08, 0.08); }
  }
  // ---- corner-guide SE (short futuristic electronic cues, no voice) ----
  tone(f0, f1, dur, type = 'square', g = 0.12, when = 0, pan = 0, bus = this.guide) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), a = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g, t + 0.006); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o.connect(a);
    if (pan && c.createStereoPanner) { const pn = c.createStereoPanner(); pn.pan.value = pan; node = node.connect(pn); }
    node.connect(bus); o.start(t); o.stop(t + dur + 0.03); autoFree(o, [a, node]);
  }
  guideSE(kind, dir = 0) {
    if (!this.ctx || !(this.vol.guide > 0)) return;
    const now = this.ctx.currentTime; this._gse ||= {};
    if (now - (this._gse[kind] || -9) < 0.6 || now - (this._gse._any || -9) < 0.12) return; // no unnatural repeats
    this._gse[kind] = now; this._gse._any = now;
    const pan = dir * 0.6; // cue comes from the side the road turns to
    switch (kind) {
      case 'curve': this.tone(1320, 1320, 0.05, 'square', 0.07, 0, pan); this.tone(1760, 1760, 0.07, 'square', 0.07, 0.055, pan); break;
      case 'sharp': [1175, 1568, 2093].forEach((f, i) => this.tone(f, f * 1.02, 0.05, 'sawtooth', 0.06, i * 0.05, pan)); break;
      case 'hairpin':
        for (let k = 0; k < 2; k++) { this.tone(1976, 1976, 0.07, 'square', 0.085, k * 0.16, pan); this.tone(1318, 1250, 0.08, 'square', 0.085, k * 0.16 + 0.075, pan); }
        this.tone(220, 110, 0.25, 'sine', 0.12, 0, pan); break;
      case 'switch': this.tone(dir < 0 ? 900 : 1400, dir < 0 ? 1400 : 900, 0.09, 'triangle', 0.09, 0, dir); break;
      case 'chain': [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, f, 0.04, 'square', 0.055, i * 0.035, pan)); break;
      case 'up': this.tone(620, 1240, 0.16, 'sine', 0.1); this.tone(1240, 1240, 0.05, 'square', 0.04, 0.16); break;
      case 'down': this.tone(1240, 620, 0.16, 'sine', 0.1); this.tone(620, 620, 0.05, 'square', 0.04, 0.16); break;
      case 'update': this.tone(2400, 2400, 0.025, 'square', 0.04, 0, pan); break;
    }
  }
  whoosh(dur = 0.6) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime; const s = this.noise(); const f = this.ctx.createBiquadFilter(); const g = this.ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(4000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfx); s.start(t); s.stop(t + dur + 0.05); autoFree(s, [f, g]);
  }
  crash(impact) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, v = Math.min(1, impact / 15);
    const s = this.noise(); const f = this.ctx.createBiquadFilter(); const g = this.ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = 900 + v * 2500;
    g.gain.setValueAtTime(0.5 * v + 0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35 + v * 0.3);
    s.connect(f).connect(g).connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.8); autoFree(s, [f, g]);
    const o = this.ctx.createOscillator(), og = this.ctx.createGain(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.2);
    og.gain.setValueAtTime(0.6 * v, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); o.connect(og).connect(this.sfx); o.start(t); o.stop(t + 0.3); autoFree(o, [og]);
    // metallic scrape ring
    const r = this.ctx.createOscillator(), rg = this.ctx.createGain(); r.type = 'triangle'; r.frequency.value = 1800 + Math.random() * 900;
    rg.gain.setValueAtTime(0.06 * v, t); rg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); r.connect(rg).connect(this.sfx); r.start(t); r.stop(t + 0.55); autoFree(r, [rg]);
  }
  shiftClunk() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime; const s = this.noise(); const f = this.ctx.createBiquadFilter(); const g = this.ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 2;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    s.connect(f).connect(g).connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.1); autoFree(s, [f, g]);
  }
  blowOff(amt = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime; const s = this.noise(); const f = this.ctx.createBiquadFilter(); const g = this.ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.35);
    g.gain.setValueAtTime(0.22 * amt, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    s.connect(f).connect(g).connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.45); autoFree(s, [f, g]);
  }

  // ---- engine -------------------------------------------------------------
  createEngine(spec, { volume = 1, player = true, muffler = 0 } = {}) {
    if (!this.ctx) return null;
    const e = new EngineVoice(this, spec, volume, player, muffler);
    this.engines.add(e); return e;
  }
  stopEngines() { for (const e of this.engines) e.stop(); this.engines.clear(); if (this.windG) { this.windG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); this.echoG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); } }
  // driving ambience: wind roar rising with speed, and a short slap-back echo inside tunnels
  environment(speed = 0, tunnel = false) {
    const c = this.ctx; if (!c) return;
    if (!this.windG) {
      const n = this.noise(), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6; this.windF = bp;
      this.windG = c.createGain(); this.windG.gain.value = 0; n.connect(bp).connect(this.windG).connect(this.sfx); n.start();
      // tunnel echo: send from the sfx bus through a feedback delay
      const d = c.createDelay(0.5); d.delayTime.value = 0.085; const fb = c.createGain(); fb.gain.value = 0.38; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      this.echoG = c.createGain(); this.echoG.gain.value = 0;
      this.sfx.connect(this.echoG); this.echoG.connect(d); d.connect(lp).connect(fb).connect(d); lp.connect(this.master);
    }
    const t = c.currentTime, k = Math.min(1, speed / 85);
    this.windG.gain.setTargetAtTime(k * k * 0.22, t, 0.2); this.windF.frequency.setTargetAtTime(350 + k * 1400, t, 0.2);
    this.echoG.gain.setTargetAtTime(tunnel ? 0.42 : 0, t, tunnel ? 0.15 : 0.4);
  }

  // ---- music --------------------------------------------------------------
  playMusic(name) {
    if (!this.ctx) { this._pendingMusic = name; return; }
    if (this.music && this.music.name === name) return;
    this.stopMusic();
    const tr = TRACKS[name]; if (!tr) return;
    this.music = new Sequencer(this, tr, name);
  }
  stopMusic(fade = 0.6) { if (this.music) { this.music.stop(fade); this.music = null; } }
}

class EngineVoice {
  constructor(sys, spec, volume, player, muffler) {
    const ctx = sys.ctx; this.sys = sys; this.spec = spec;
    const type = spec.engine.type;
    this.rotary = type === 'ROTARY';
    this.cyl = spec.engine.cyl;
    this.out = ctx.createGain(); this.out.gain.value = 0;
    this.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const dest = this.pan ? (this.out.connect(this.pan), this.pan) : this.out;
    dest.connect(sys.sfx);
    this.vol = volume * (player ? 0.5 : 0.35) * (1 + muffler * 0.6);
    this.layout = layoutOf(spec);
    if (sys.worklet) {
      // combustion-pulse synthesis: per-car exhaust resonances derived from displacement & id
      const h = hashStr(spec.id || spec.name || 'car');
      const disp = spec.disp || 2000;
      const base = this.layout === 'ROTARY' ? 210 : 70 + 180000 / (disp + 600) * (0.85 + (h % 7) * 0.05);
      const res = spec.sound.res || [base, base * (2.6 + (h % 5) * 0.15), base * (6.5 + (h % 3) * 0.6)];
      this.node = new AudioWorkletNode(ctx, 'rd-engine', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1],
        processorOptions: { layout: this.layout, redline: spec.engine.redline, res, rasp: spec.sound.rasp, loud: muffler, seed: h, mix: this.layout === 'ROTARY' ? [1, 0.9, 0.6] : this.layout === 'I6' ? [0.8, 0.8, 0.5] : [1, 0.6, 0.35] } });
      this.P = (n) => this.node.parameters.get(n);
      const tone = ctx.createBiquadFilter(); tone.type = 'lowshelf'; tone.frequency.value = 180; tone.gain.value = this.layout === 'BOXER' || this.layout === 'V6' ? 6 : 3;
      this.node.connect(tone).connect(this.out);
      this.wk = true;
    }
    // oscillators (fallback engine; a quiet mechanical layer under the worklet)
    const mk = (t) => { const o = ctx.createOscillator(); o.type = t; o.start(); return o; };
    this.o1 = mk(this.rotary ? 'square' : 'sawtooth');
    this.o2 = mk('square'); // sub
    this.o3 = mk('sawtooth'); this.o3.detune.value = 9;
    this.g1 = ctx.createGain(); this.g2 = ctx.createGain(); this.g3 = ctx.createGain();
    this.g1.gain.value = 0.5; this.g2.gain.value = this.rotary ? 0.15 : 0.35 + muffler * 0.2; this.g3.gain.value = this.rotary ? 0.4 : 0.22;
    this.shaper = ctx.createWaveShaper(); this.shaper.curve = sys.curve; this.shaper.oversample = '2x';
    this.drive = ctx.createGain(); this.drive.gain.value = 1.5 + spec.sound.rasp;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 2.5;
    this.o1.connect(this.g1).connect(this.drive); this.o2.connect(this.g2).connect(this.drive); this.o3.connect(this.g3).connect(this.drive);
    // firing pulse amplitude modulation (gives the "chug" of individual combustions)
    this.am = ctx.createGain(); this.am.gain.value = 0.7;
    this.lfo = mk('square'); this.lfoG = ctx.createGain(); this.lfoG.gain.value = 0.3;
    this.lfo.connect(this.lfoG).connect(this.am.gain);
    this.drive.connect(this.shaper).connect(this.am).connect(this.lp);
    this.oscOut = ctx.createGain(); this.oscOut.gain.value = this.wk ? 0.12 : 1; this.lp.connect(this.oscOut).connect(this.out);
    // intake / exhaust noise
    this.nz = sys.noise(); this.nzF = ctx.createBiquadFilter(); this.nzF.type = 'bandpass'; this.nzF.Q.value = 0.8; this.nzG = ctx.createGain(); this.nzG.gain.value = 0;
    this.nz.connect(this.nzF).connect(this.nzG).connect(this.out); this.nz.start(0, Math.random());
    // turbo whistle
    if (spec.sound.turbo) { this.tw = mk('sine'); this.twG = ctx.createGain(); this.twG.gain.value = 0; this.tw.connect(this.twG).connect(this.out); }
    // tyre squeal (two band-passed noise voices)
    this.sq = sys.noise(); this.sqF = ctx.createBiquadFilter(); this.sqF.type = 'bandpass'; this.sqF.Q.value = 6; this.sqF.frequency.value = 1100;
    this.sqF2 = ctx.createBiquadFilter(); this.sqF2.type = 'bandpass'; this.sqF2.Q.value = 9; this.sqF2.frequency.value = 2100;
    this.sqG = ctx.createGain(); this.sqG.gain.value = 0;
    this.scr = ctx.createOscillator(); this.scr.type = 'triangle'; this.scr.frequency.value = 900; this.scrG = ctx.createGain(); this.scrG.gain.value = 0;
    this.scrLfo = ctx.createOscillator(); this.scrLfo.frequency.value = 23; this.scrLfoG = ctx.createGain(); this.scrLfoG.gain.value = 60; this.scrLfo.connect(this.scrLfoG).connect(this.scr.frequency);
    this.scr.connect(this.scrG); this.scr.start(); this.scrLfo.start();
    this.sq.connect(this.sqF).connect(this.sqG); this.sq.connect(this.sqF2).connect(this.sqG); this.sqG.connect(dest); this.sq.start(0, Math.random());
    this.scrG.connect(dest);
    // gravel rumble
    this.gr = sys.noise(); this.grF = ctx.createBiquadFilter(); this.grF.type = 'lowpass'; this.grF.frequency.value = 400; this.grG = ctx.createGain(); this.grG.gain.value = 0;
    this.gr.connect(this.grF).connect(this.grG).connect(dest); this.gr.start(0, Math.random());
    this.alive = true;
  }
  update(v, throttle, { dist = 0, pan = 0, gravel = 0 } = {}) {
    if (!this.alive) return;
    const ctx = this.sys.ctx, t = ctx.currentTime, k = 0.03;
    const e = this.spec.engine;
    const rpm = v.rpm;
    const fire = this.rotary ? rpm / 60 * 2 : rpm / 60 * this.cyl / 2;
    const p = this.spec.sound.pitch;
    this.o1.frequency.setTargetAtTime(fire * p, t, k);
    this.o2.frequency.setTargetAtTime(fire * 0.5 * p, t, k);
    this.o3.frequency.setTargetAtTime(fire * (this.rotary ? 1.5 : 2) * p, t, k);
    this.lfo.frequency.setTargetAtTime(rpm / 60 * (this.rotary ? 1 : 0.5), t, k);
    const rf = (rpm - e.idle) / (e.redline - e.idle);
    const th = Math.max(0.12, throttle);
    this.lp.frequency.setTargetAtTime(300 + th * 2400 + rf * 2600 + (this.rotary ? 1200 : 0), t, k);
    this.drive.gain.setTargetAtTime(1 + th * 2 + this.spec.sound.rasp, t, k);
    this.nzF.frequency.setTargetAtTime(500 + rf * 2500, t, k);
    this.nzG.gain.setTargetAtTime(0.05 + th * 0.12 * (0.4 + rf), t, k);
    const att = 1 / (1 + dist * dist * 0.004);
    const lim = v.limiterHit > 0.04 ? 0.55 : 1;
    this.out.gain.setTargetAtTime(this.vol * (this.wk ? 1 : (0.45 + th * 0.55)) * att * (this.wk ? 1 : lim), t, 0.02);
    if (this.wk) {
      const load = throttle > 0.05 ? throttle : (rpm > e.idle * 1.3 ? -0.6 : 0);
      this.P('rpm').setTargetAtTime(rpm * p, t, 0.012);
      this.P('load').setTargetAtTime(load, t, 0.03);
      this.P('cut').setValueAtTime(v.limiterHit > 0.045 || (v.shiftTimer > 0 && throttle > 0.1) ? 1 : 0, t);
      this.P('gain').setTargetAtTime(1.1, t, 0.05);
    }
    if (this.pan) this.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.05);
    if (this.tw) { this.tw.frequency.setTargetAtTime(1800 + v.boost * 4200, t, 0.05); this.twG.gain.setTargetAtTime(v.boost * 0.035 * th, t, 0.05); }
    const slip = Math.max(v.slipRear, v.slipFront * 0.8) * Math.min(1, v.speed / 8) * (1 - gravel);
    this.sqG.gain.setTargetAtTime(Math.min(0.5, slip * 0.45) * att, t, 0.04);
    this.sqF.frequency.setTargetAtTime(900 + slip * 500 + Math.sin(t * 13) * 60, t, 0.05);
    const da = Math.min(1, Math.abs(v.driftAngle || 0) * 2.2) * Math.min(1, v.speed / 10) * (1 - gravel);
    this.scrG.gain.setTargetAtTime(da * 0.05 * att, t, 0.06);
    this.scr.frequency.setTargetAtTime(760 + da * 260 + v.speed * 2, t, 0.1);
    this.grG.gain.setTargetAtTime(gravel * Math.min(1, v.speed / 15) * 0.4 * att, t, 0.05);
  }
  stop() {
    if (!this.alive) return; this.alive = false;
    const t = this.sys.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.1); this.sqG.gain.setTargetAtTime(0, t, 0.05); this.scrG.gain.setTargetAtTime(0, t, 0.05); this.grG.gain.setTargetAtTime(0, t, 0.05);
    setTimeout(() => { if (this.node) { try { this.node.disconnect(); } catch { } } [this.o1, this.o2, this.o3, this.lfo, this.nz, this.sq, this.gr, this.tw, this.scr, this.scrLfo].forEach(o => { try { o && o.stop(); } catch { } }); try { this.out.disconnect(); this.sqG.disconnect(); this.grG.disconnect(); } catch { } }, 600);
  }
}

// ---- procedural music --------------------------------------------------------
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// chords as midi roots + minor/major flag
const TRACKS = {
  title: { bpm: 118, prog: [[57, 'm'], [53, 'M'], [55, 'M'], [52, 'm']], kick: [0, 8], snare: [4, 12], hat: 'off', bass: 'eighth', pad: true, lead: [0, 3, 7, 10, 12, 10, 7, 3], leadOct: 1, swing: 0 },
  menu: { bpm: 126, prog: [[50, 'm'], [58, 'M'], [53, 'M'], [55, 'M']], kick: [0, 4, 8, 12], snare: [4, 12], hat: 'off', bass: 'off', pad: true, lead: null, arp: true },
  race: { bpm: 156, prog: [[57, 'm'], [53, 'M'], [55, 'M'], [57, 'm'], [50, 'm'], [53, 'M'], [52, 'M'], [52, 'M']], kick: [0, 4, 8, 12], snare: [4, 12], hat: 'off', bass: 'octave', pad: false, stab: true, lead: [12, 15, 19, 17, 15, 12, 10, 12, 15, 14, 12, 10, 7, 10, 12, 0], leadOct: 1 },
  result: { bpm: 112, prog: [[60, 'M'], [55, 'M'], [57, 'm'], [53, 'M']], kick: [0, 8], snare: [4, 12], hat: 'eighth', bass: 'eighth', pad: true, lead: [0, 4, 7, 12, 11, 7, 4, 7], leadOct: 1 },
};

class Sequencer {
  constructor(sys, tr, name) {
    this.sys = sys; this.tr = tr; this.name = name; const ctx = sys.ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(sys.bgm);
    this.out.gain.setTargetAtTime(1, ctx.currentTime, 0.3);
    this.step = 0; this.next = ctx.currentTime + 0.1; this.spb = 60 / tr.bpm / 4; // 16ths
    this.timer = setInterval(() => this.tick(), 25);
  }
  tick() {
    const ctx = this.sys.ctx;
    if (this.next < ctx.currentTime - 0.2) this.next = ctx.currentTime + 0.05; // timer was throttled (background tab / long load): skip, don't schedule the whole backlog at once
    while (this.next < ctx.currentTime + 0.12) { this.play(this.step, this.next); this.step++; this.next += this.spb; }
  }
  play(step, t) {
    const tr = this.tr; const s16 = step % 16; const bar = Math.floor(step / 16);
    const [root, q] = tr.prog[bar % tr.prog.length];
    const third = q === 'm' ? 3 : 4;
    if (tr.kick.includes(s16)) this.kick(t);
    if (tr.snare.includes(s16)) this.snare(t);
    if ((tr.hat === 'off' && s16 % 4 === 2) || (tr.hat === 'eighth' && s16 % 2 === 0)) this.hat(t, s16 % 4 === 2 ? 0.07 : 0.035);
    if (s16 % 2 === 1 && tr.hat === 'off') this.hat(t, 0.02);
    if (tr.bass === 'octave' && s16 % 2 === 0) this.bass(NOTE(root - 24 + (s16 % 4 === 2 ? 12 : 0)), t, this.spb * 1.8);
    if (tr.bass === 'eighth' && s16 % 2 === 0) this.bass(NOTE(root - 24), t, this.spb * 1.6);
    if (tr.bass === 'off' && s16 % 4 === 2) this.bass(NOTE(root - 24), t, this.spb * 1.8);
    if (tr.pad && s16 === 0) [0, third, 7, 12].forEach(iv => this.pad(NOTE(root + iv), t, this.spb * 16));
    if (tr.stab && (s16 === 0 || s16 === 3 || s16 === 6 || s16 === 10)) [0, third, 7].forEach(iv => this.stab(NOTE(root + iv), t));
    if (tr.arp && s16 % 2 === 0) { const ivs = [0, third, 7, 12, 7, third]; this.lead(NOTE(root + 12 + ivs[(s16 / 2) % ivs.length]), t, this.spb * 1.5, 0.035); }
    if (tr.lead && bar % 4 >= 2 && s16 % 2 === 0) {
      const i = (s16 / 2 + (bar % 2) * 8) % tr.lead.length; const n = tr.lead[i];
      this.lead(NOTE(root + n + 12 * (tr.leadOct || 0)), t, this.spb * 1.9, 0.05);
    }
  }
  env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  kick(t) { const c = this.sys.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); this.env(g, t, 0.002, 0.9, 0.25); o.connect(g).connect(this.out); o.start(t); o.stop(t + 0.3); autoFree(o, [g]); }
  snare(t) { const c = this.sys.ctx, s = this.sys.noise(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = 1500; this.env(g, t, 0.002, 0.35, 0.18); s.connect(f).connect(g).connect(this.out); s.start(t, Math.random()); s.stop(t + 0.2); autoFree(s, [f, g]); }
  hat(t, v) { const c = this.sys.ctx, s = this.sys.noise(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = 8000; this.env(g, t, 0.001, v, 0.05); s.connect(f).connect(g).connect(this.out); s.start(t, Math.random()); s.stop(t + 0.06); autoFree(s, [f, g]); }
  bass(fr, t, d) { const c = this.sys.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = fr; f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(200, t + d); this.env(g, t, 0.005, 0.32, d); o.connect(f).connect(g).connect(this.out); o.start(t); o.stop(t + d + 0.02); autoFree(o, [f, g]); }
  pad(fr, t, d) { const c = this.sys.ctx; const g = c.createGain(); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035, t + 0.4); g.gain.setValueAtTime(0.035, t + d - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + d); f.connect(g).connect(this.out); const os = []; for (const dt of [-8, 8]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = dt; o.connect(f); o.start(t); o.stop(t + d + 0.05); os.push(o); } autoFree(os, [f, g]); }
  stab(fr, t) { const c = this.sys.ctx; const g = c.createGain(); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(4000, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.2); this.env(g, t, 0.003, 0.06, 0.22); f.connect(g).connect(this.out); const os = []; for (const dt of [-14, 0, 14]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = dt; o.connect(f); o.start(t); o.stop(t + 0.25); os.push(o); } autoFree(os, [f, g]); }
  lead(fr, t, d, v) { const c = this.sys.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(); o.type = 'square'; o2.type = 'sawtooth'; o.frequency.value = fr; o2.frequency.value = fr * 1.003; this.env(g, t, 0.01, v, d); o.connect(g); o2.connect(g); g.connect(this.out); o.start(t); o2.start(t); o.stop(t + d + 0.02); o2.stop(t + d + 0.02); autoFree([o, o2], [g]); }
  stop(fade) { const c = this.sys.ctx; this.out.gain.setTargetAtTime(0, c.currentTime, fade / 3); clearInterval(this.timer); setTimeout(() => this.out.disconnect(), fade * 1000 + 200); }
}

function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// free one-shot voices once they finish (Safari keeps finished-but-connected nodes alive → memory grows → tab crash)
function autoFree(srcs, nodes) {
  srcs = [].concat(srcs); let left = srcs.length;
  for (const s of srcs) s.onended = () => { try { s.disconnect(); } catch { } if (--left <= 0) for (const n of nodes) { try { n.disconnect(); } catch { } } };
}
export function layoutOf(spec) {
  const t = spec.engine.type;
  if (t === 'ROTARY') return 'ROTARY';
  if (t === 'TURBO6' || t === 'NA6') return 'I6';
  if (t === 'BOXER4' || t === 'BOXERT') return 'BOXER';
  if (t === 'V6' || t === 'V6T') return 'V6';
  return 'I4';
}
export const Audio = new AudioSys();
