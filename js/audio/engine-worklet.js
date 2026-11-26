// REVOLUTION DRIVE — engine sound synthesiser (AudioWorklet)
// Physically-inspired: each cylinder (or rotor face) fires an exhaust pulse at its real crank
// angle; the pulse train excites exhaust-pipe resonances and a load-dependent muffler filter.
//   I4    : 4 pulses / 720°, even (180°)               → buzzy, honky
//   I6    : 6 pulses / 720°, even (120°)               → smooth, silky, higher
//   BOXER : 4 pulses / 720°, unequal-length headers     → offbeat "rumble"
//   V6    : 6 pulses / 720°, slightly uneven bank pulses → hoarse growl
//   ROTARY: 2 rotors, 1 pulse per rotor per shaft turn   → sharp, very high "brap"
// AudioParams: rpm, load (-1 overrun … +1 full throttle), cut (ignition cut), gain.

const TAU = Math.PI * 2;
const LAYOUTS = {
  I4: { cycle: 4 * Math.PI, fire: [0, 180, 360, 540], amp: [1, 1, 1, 1], width: 0.0030, noise: 0.35 },
  I6: { cycle: 4 * Math.PI, fire: [0, 120, 240, 360, 480, 600], amp: [1, 1, 1, 1, 1, 1], width: 0.0024, noise: 0.25 },
  BOXER: { cycle: 4 * Math.PI, fire: [0, 205, 360, 565], amp: [1.15, 0.8, 1.1, 0.85], width: 0.0034, noise: 0.4 },
  V6: { cycle: 4 * Math.PI, fire: [0, 110, 240, 350, 480, 590], amp: [1.1, 0.9, 1.05, 0.92, 1.08, 0.9], width: 0.0028, noise: 0.35 },
  ROTARY: { cycle: 2 * Math.PI, fire: [0, 180], amp: [1, 1], width: 0.0013, noise: 0.75 },
};

class Biquad {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  bandpass(f, q, sr) { const w = TAU * f / sr, a = Math.sin(w) / (2 * q), c = Math.cos(w), n = 1 + a; this.b0 = a / n; this.b1 = 0; this.b2 = -a / n; this.a1 = -2 * c / n; this.a2 = (1 - a) / n; }
  lowpass(f, q, sr) { const w = TAU * Math.min(f, sr * 0.45) / sr, a = Math.sin(w) / (2 * q), c = Math.cos(w), n = 1 + a; this.b0 = (1 - c) / 2 / n; this.b1 = (1 - c) / n; this.b2 = (1 - c) / 2 / n; this.a1 = -2 * c / n; this.a2 = (1 - a) / n; }
  run(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}

class EngineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 900, minValue: 0, maxValue: 12000, automationRate: 'k-rate' },
      { name: 'load', defaultValue: 0, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
      { name: 'cut', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'gain', defaultValue: 0.5, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
    ];
  }
  constructor(opts) {
    super();
    const o = opts.processorOptions || {};
    this.L = LAYOUTS[o.layout] || LAYOUTS.I4;
    this.layout = o.layout || 'I4';
    this.redline = o.redline || 7500;
    this.res = o.res || [140, 420, 1150];       // exhaust pipe resonances (Hz) — differ per car
    this.resQ = o.resQ || [3.5, 4.5, 5];
    this.mix = o.mix || [1, 0.6, 0.35];
    this.rasp = o.rasp ?? 0.6;
    this.loud = o.loud ?? 0;                     // muffler (dress-up) 0..0.3
    this.seed = o.seed || 1234567;
    this.fireRad = this.L.fire.map(d => d * Math.PI / 180);
    this.phase = 0; this.pulses = new Float32Array(16 * 3); this.np = 0;
    this.bp = this.res.map(() => new Biquad());
    this.lp = new Biquad(); this.lp2 = new Biquad(); this.intake = new Biquad();
    this.lastRpm = -1; this.smoothLoad = 0; this.dc = 0;
  }
  rand() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  process(_, outputs, P) {
    const out = outputs[0][0]; if (!out) return true;
    const sr = sampleRate;
    const rpm = P.rpm[0], load = P.load[0], cut = P.cut[0] > 0.5, gain = P.gain[0];
    this.smoothLoad += (load - this.smoothLoad) * 0.2;
    const ld = this.smoothLoad, on = Math.max(0, ld), rf = Math.min(1.2, rpm / this.redline);
    // per-block filter updates: resonances brighten a little with revs; muffler opens with load
    if (Math.abs(rpm - this.lastRpm) > 20 || this.lastRpm < 0) {
      this.bp.forEach((b, i) => b.bandpass(this.res[i] * (1 + rf * (0.15 + i * 0.12)), this.resQ[i], sr));
      this.intake.bandpass(380 + rf * 1400, 1.2, sr);
      this.lastRpm = rpm;
    }
    const cutoff = (this.layout === 'ROTARY' ? 1800 : 900) + on * 3200 + rf * 2600 + this.loud * 4000;
    this.lp.lowpass(cutoff, 0.8, sr); this.lp2.lowpass(cutoff * 1.6, 0.7, sr);
    const dTheta = rpm / 60 * TAU / sr;
    const cyc = this.L.cycle, fire = this.fireRad, width = this.L.width;
    // amplitude: louder with load, normalised so more pulses per second do not simply get louder
    const pps = rpm / 60 * fire.length * (TAU / cyc);
    const norm = 1 / Math.sqrt(Math.max(20, pps) / 60);
    const baseAmp = (0.32 + 0.68 * on + (ld < 0 ? 0.08 : 0)) * norm;
    const lope = this.layout === 'ROTARY' ? Math.max(0, 1 - rpm / 2600) : Math.max(0, 1 - rpm / 1400) * 0.4;
    for (let n = 0; n < out.length; n++) {
      const prev = this.phase;
      this.phase += dTheta;
      // ignition events crossed in this sample
      for (let c = 0; c < fire.length; c++) {
        const f = fire[c];
        const a0 = prev % cyc, a1 = this.phase % cyc;
        const crossed = a1 >= a0 ? (f > a0 && f <= a1) : (f > a0 || f <= a1);
        if (!crossed) continue;
        if (cut && this.rand() < 0.65) continue;                       // rev limiter
        if (lope > 0 && this.rand() < lope * 0.12) continue;           // lumpy idle / rotary lope
        let amp = baseAmp * this.L.amp[c] * (1 + (this.rand() - 0.5) * (0.12 + lope * 0.6));
        let pop = 0;
        if (ld < -0.05 && rf > 0.4 && this.rand() < 0.035 + this.loud * 0.15) { amp *= 2.6; pop = 1; } // overrun crackle
        if (this.np < 16) { const k = this.np * 3; this.pulses[k] = 0; this.pulses[k + 1] = amp; this.pulses[k + 2] = pop; this.np++; }
      }
      if (this.phase > cyc * 1000) this.phase -= cyc * 1000;
      // render active pulses: half-sine pressure wave + decaying combustion noise
      let ex = 0;
      for (let i = 0; i < this.np; i++) {
        const k = i * 3; const t = this.pulses[k]; const amp = this.pulses[k + 1]; const pop = this.pulses[k + 2];
        const w = width * (pop ? 1.8 : 1);
        if (t < w) ex += amp * Math.sin(Math.PI * t / w);
        ex += amp * (this.L.noise + pop * 1.5) * (this.rand() * 2 - 1) * Math.exp(-t / (pop ? 0.006 : 0.0025));
        this.pulses[k] = t + 1 / sr;
        if (t > 0.03) { // retire
          this.np--; this.pulses[k] = this.pulses[this.np * 3]; this.pulses[k + 1] = this.pulses[this.np * 3 + 1]; this.pulses[k + 2] = this.pulses[this.np * 3 + 2]; i--;
        }
      }
      // exhaust resonances + direct path, then muffler
      let y = ex * 0.45;
      for (let i = 0; i < this.bp.length; i++) y += this.bp[i].run(ex) * this.mix[i] * 2.2;
      y = this.lp.run(this.lp2.run(y));
      // intake roar (load dependent) and mechanical rasp
      y += this.intake.run((this.rand() * 2 - 1)) * on * (0.04 + rf * 0.08);
      y = Math.tanh(y * (1.4 + this.rasp + on * 0.8)) * 0.8;
      this.dc += (y - this.dc) * 0.002; // DC blocker
      out[n] = (y - this.dc) * gain;
    }
    return true;
  }
}
registerProcessor('rd-engine', EngineProcessor);
