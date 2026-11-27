// REVOLUTION DRIVE — vehicle dynamics: the Drift Legends vehicle controller
// Chassis, tyres, steering, counter-steer assist, handbrake, load transfer and yaw are a line-by-line
// port of Drift Legends' Vehicle.step (developeraoi/drift-legends · source/src/physics.js).
// RD's own engine / turbo / gearbox model feeds the drive force exactly where DL's engine does.
// Conventions (identical to DL): world plane (x,z), y up, forward = (sin yaw, cos yaw), right = (−cos yaw, sin yaw).
//   DL keeps `heading` and a yaw rate r with heading −= r·dt (r > 0 = turning RIGHT).
//   RD stores yaw = heading and this.r = dYaw/dt (+ = turning LEFT), i.e. this.r = −r_DL. Steering input + = right.
const G = 9.81;
const K_PEAK = 0.11;     // slip ratio at peak longitudinal force
const A_PEAK = 0.13;     // slip angle (tan) at peak lateral force
const C_SHAPE = 1.5;     // curve shape: sliding friction ≈ sin(C·π/2) ≈ 0.71 of peak
const B_SHAPE = Math.tan(Math.PI / (2 * C_SHAPE)); // peak exactly at normalised slip 1
const mf = (s) => Math.sin(C_SHAPE * Math.atan(B_SHAPE * s));

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const tireCurve = (alpha, B, C) => { const s = alpha < 0 ? -1 : 1; return s * Math.sin(C * Math.atan(B * Math.abs(alpha))); };

// RD car spec → the parameter set DL's computeSpec produces (muF/muR, B/C slide curve, LSD, steering, transfer…)
// RD cars have no "handling/drift" ratings, so the character comes from drivetrain, engine, weight and upgrades:
//   FR: loose rear, LSD · rotary / high-power turbo: easier throttle slides · FF: front-led, open diff · 4WD: planted
export function dlSpec(spec, a, b) {
  const mass = spec.mass, drive = spec.drive, eng = spec.engine || {};
  const rotary = eng.type === 'ROTARY' || spec.sound?.type === 'rotary';
  const turbo = !!spec.sound?.turbo;
  const pw = (eng.hp || 200) / mass * 1000; // hp per tonne
  // "drift" rating 0..100 in DL terms
  let drift = drive === 'FR' ? 82 : drive === '4WD' ? 62 : 50;
  if (rotary) drift += 6; if (turbo && pw > 200) drift += 3; drift += clamp((1300 - mass) / 100, -4, 4);
  const handling = clamp(70 + (spec.suspensionLevel || 0) * 4 + (1400 - mass) / 60 + (spec.downforce || 0) * 10, 40, 100);
  const mu = spec.tire.grip;
  const cam = Math.abs(-1.0 - (spec.setup?.camber || 0) * 0.6); // DL default camber −1.0°
  const toeR = 0.1;                                            // DL default rear toe-in
  const latCam = 1 + 0.022 * Math.min(cam, 2.5) - 0.035 * Math.max(0, cam - 2.5);
  const lsd = clamp((drift >= 84 ? 0.45 : drive === 'FR' ? 0.45 : 0.22) + (spec.traction || 0) * 0.06, 0.15, 0.95);
  const slide = clamp(0.72 + (drift - 70) / 100 * 0.08, 0.6, 0.92);
  const C = 2 - 2 * Math.asin(slide) / Math.PI;
  const B = Math.tan(Math.PI / (2 * C)) / 0.12;
  const susp = spec.suspensionLevel || 0;
  const df = spec.downforce || 0;
  return {
    mass, a, b, wb: spec.wheelbase, cgH: spec.cgHeight, I: mass * a * b * 1.05, drive,
    driveR: drive === 'FF' ? 0 : drive === '4WD' ? 1 - (spec.split ?? 0.38) : 1,
    muF: mu * latCam * (0.92 + handling / 100 * 0.12) * (1 + susp * 0.015),
    muR: mu * latCam * (1.02 - drift / 100 * 0.06) * (1 + toeR * 0.15),
    B, C, slide, lsd, lsd2way: false, hp: eng.hp || 200,
    brakeMax: mass * 9.81 * 1.25 * (spec.brake || 1),
    steerMax: (spec.steerLock || 0.6) * (spec.setup?.steerSens || 1), counterMax: 0.7,
    transfer: 5 + susp * 2.5 + (spec.setup?.stiffness || 0) * 1.2, rollK: 1 / (1 + susp * 0.35),
    roll: 12 + mass * 0.012, downF: df * 0.35, downR: df * 1.1, yawDamp: 0.1 + toeR * 0.4, drift, rotary, turbo,
  };
}

export class Vehicle {
  constructor(spec) { this.setSpec(spec); this.reset(0, 0, 0, 0); }

  setSpec(spec) {
    this.spec = spec;
    const L = spec.wheelbase;
    this.a = L * (1 - spec.weightFront);
    this.b = L * spec.weightFront;
    this.inertia = spec.mass * this.a * this.b * 1.05; // Drift Legends yaw inertia
    const tp = Math.max(...spec.engine.curve.map(p => p[1]));
    this.curve = spec.engine.curve.map(p => [p[0], p[1] / tp]);
    this.peakTorque = spec.engine.torque;
    this.susp = spec.suspensionLevel || 0;
    this.Iw = 2.6;                                  // two wheels + hubs, per axle (kg m²)
    this.Ie = 0.11 * (spec.engine.inertia || 1);     // crank + flywheel
    this.cda = 0.5 * 1.225 * (spec.cda || 0.68);
    this.dl = dlSpec(spec, this.a, this.b);
  }

  reset(x, y, z, yaw) {
    Object.assign(this, { x, y, z, yaw, vx: 0, vz: 0, vy: 0, r: 0, wF: 0, wR: 0 });
    this.gear = 1; this.rpm = this.spec.engine.idle; this.shiftTimer = 0; this.clutch = 1;
    this.steer = 0; this.boost = 0; this.u = 0; this.v = 0; this.ax = 0; this.ay = 0; this.axLag = 0;
    this.pitch = 0; this.roll = 0; this.pitchV = 0; this.rollV = 0;
    this.slipFront = 0; this.slipRear = 0; this.wheelspin = 0; this.lockup = 0;
    this.driftAngle = 0; this.wheelRot = 0; this.wheelRotF = 0; this.wheelRotR = 0; this.limiterHit = 0;
    this.surfaceGrip = 1; this.steerIn = 0; this.delta = 0; this.beta = 0; this.axF = 0; this.axDL = 0; this.spinF = 0; this.spinR = 0; this.handOn = 0; this.events = []; this.throttleIn = 0; this.load = 0; this.decel = 0;
  }

  get speed() { return Math.hypot(this.vx, this.vz); }
  get kmh() { return this.speed * 3.6; }

  torqueAt(rpm) {
    const c = this.curve;
    if (rpm <= c[0][0]) return c[0][1];
    for (let i = 1; i < c.length; i++) if (rpm <= c[i][0]) { const t = (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]); return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t; }
    return c[c.length - 1][1] * 0.6;
  }
  gearRatio(g = this.gear) {
    if (g === 0) return 0;
    if (g < 0) return -this.spec.reverse * this.spec.final;
    return this.spec.gears[g - 1] * this.spec.final;
  }
  shift(dir) {
    const n = this.spec.gears.length;
    let ng = Math.max(-1, Math.min(n, this.gear + dir));
    if (ng === 0) ng = dir > 0 ? 1 : -1;
    if (ng === this.gear) return;
    const from = this.gear; this.gear = ng;
    this.shiftTimer = this.spec.shiftTime || 0.2;
    this.events.push({ type: 'shift', dir, gear: ng, from });
  }

  step(dt, input, opts = {}) {
    const s = this.spec, e = s.engine, m = s.mass, R = s.tire.radius;
    const easy = opts.easyDrift || 0;                                   // RD EASY DRIFT (0..1) — extra assist on top of DL's
    const assist = Math.min(1, (opts.driftAssist ?? 0.6) + easy * 0.4);
    const auto = opts.autoGear ?? true;
    let throttle = clamp(input.throttle, 0, 1), brake = clamp(input.brake, 0, 1);

    const S = this.dl;
    const heading = this.yaw;
    const fwdX = Math.sin(heading), fwdZ = Math.cos(heading), rgtX = -fwdZ, rgtZ = fwdX;
    let vx = this.vx * fwdX + this.vz * fwdZ, vy = this.vx * rgtX + this.vz * rgtZ; // DL: vx forward, vy RIGHT
    let rDL = -this.r;
    const spd = Math.hypot(vx, vy);
    // --- 入力（ステア角は押している時間で増加） --- DL steering, verbatim
    const steerRate = input.steerRate || 2.6;
    const target = clamp(input.steer, -1, 1);
    const rate = (Math.sign(target) !== Math.sign(this.steerIn) && Math.abs(this.steerIn) > 0.02) || Math.abs(target) < 0.01 ? steerRate * 2.2 : steerRate;
    this.steerIn += clamp(target - this.steerIn, -rate * dt, rate * dt);
    if (input.analog) this.steerIn = target;
    const vxe = Math.max(Math.abs(vx), 2.5);
    const maxSteer = S.steerMax / (1 + Math.max(0, spd - 8) / (opts.highway ? 24 : 32)) + (opts.highway ? 0.035 : 0.06);
    let delta = this.steerIn * maxSteer;
    const beta = Math.atan2(vy, vxe); this.beta = beta;
    if (assist > 0 && spd > 6 && vx > 0) {
      const k = assist * clamp((Math.abs(beta) - 0.04) / 0.18, 0, 1);
      const counter = clamp(beta + this.steerIn * 0.38, -S.counterMax, S.counterMax);
      delta = lerp(delta, counter, k);
    }
    this.delta = delta; this.steer = -delta; // RD visual convention (+ = wheels turned left)
    const u = vx; const speed = spd;
    // ---- gearbox: auto reverse / auto shifting ----------------------------------------------
    if (this.shiftTimer > 0) this.shiftTimer -= dt;
    const shifting = this.shiftTimer > 0;
    if (auto) {
      if (this.gear > 0 && vx < 0.5 && brake > 0.5 && throttle < 0.1) { this.gear = -1; }
      else if (this.gear < 0 && throttle > 0.3 && vx > -0.5 && brake < 0.1) { this.gear = 1; }
      if (this.gear < 0) { const t = throttle; throttle = brake; brake = t; }
    }
    this.throttleIn = throttle;
    const ratio = this.gearRatio();
    const split = s.drive === 'FF' ? 1 : s.drive === 'FR' ? 0 : (s.split ?? 0.4);
    // driven wheel speed → engine speed
    const wDrive = split >= 1 ? this.wF : split <= 0 ? this.wR : this.wF * split + this.wR * (1 - split);
    const rpmWheels = Math.abs(wDrive * ratio) * 60 / (2 * Math.PI);
    const launchRpm = e.idle + throttle * e.redline * (0.38 + (s.launch || 0) * 0.03);
    let clutchSlip = false;
    let engRpm;
    if (this.gear === 0 || shifting) {
      // clutch open: revs fall (or blip on downshift) toward the wheel speed in the new gear
      const tgt = shifting ? rpmWheels : e.idle + throttle * e.redline;
      engRpm = this.rpm + (tgt - this.rpm) * Math.min(1, dt * 14);
    } else if (rpmWheels < launchRpm && Math.abs(this.gear) === 1 && throttle > 0.05) {
      engRpm = this.rpm + (launchRpm - this.rpm) * Math.min(1, dt * 8); clutchSlip = true;
    } else engRpm = Math.max(rpmWheels, e.idle * 0.95);
    let cut = false;
    if (engRpm >= e.limiter) { engRpm = e.limiter; cut = true; this.limiterHit = 0.09; }
    if (this.limiterHit > 0) { this.limiterHit -= dt; if (this.limiterHit > 0.045) cut = true; }
    this.rpm = engRpm;
    this.clutch = shifting || this.gear === 0 ? 0 : clutchSlip ? Math.min(1, rpmWheels / launchRpm) : 1;

    // turbo
    if (s.sound.turbo) {
      const want = throttle > 0.35 ? Math.min(1, Math.max(0, (this.rpm - e.idle * 1.8) / (e.redline * 0.42))) : 0;
      const prev = this.boost;
      this.boost += (want - this.boost) * Math.min(1, dt * (want > this.boost ? 1.5 * (s.boostRate || 1) : 7));
      if (prev > 0.55 && throttle < 0.2 && !this._bov) { this.events.push({ type: 'bov', amt: prev }); this._bov = true; }
      if (throttle > 0.5) this._bov = false;
    } else this.boost = 1;

    // engine torque (+ engine braking when off throttle)
    const tq = this.torqueAt(this.rpm) * (s.sound.turbo ? 0.6 + 0.4 * this.boost : 1) * this.peakTorque * (this.powerFactor || 1);
    let Teng = (cut || shifting || this.gear === 0) ? 0 : tq * throttle;
    const engBrake = throttle < 0.05 && !shifting && this.gear !== 0 ? this.peakTorque * (0.07 + 0.10 * this.rpm / e.redline) : 0;
    Teng -= engBrake;
    this.load = Teng / this.peakTorque; this.decel = engBrake > 0 ? 1 : 0;
    const Taxle = Teng * ratio * 0.88 * (clutchSlip ? 1 : 1);

    const driveF = Teng * ratio * 0.88 / R;           // DL: Tq·gear·final·0.86 / wheelR (RD gearRatio() includes final)
    // --- 荷重 --- DL load transfer
    const L = S.wb, h = S.cgH;
    this.axF = damp(this.axF || 0, this.axDL || 0, S.transfer, dt);
    const down = 0.6 * spd * spd;
    let Wf = m * G * S.b / L - m * this.axF * h / L + down * S.downF;
    let Wr = m * G * S.a / L + m * this.axF * h / L + down * S.downR;
    Wf = Math.max(Wf, m * G * 0.12); Wr = Math.max(Wr, m * G * 0.12);
    const Wf0 = m * G * S.b / L, Wr0 = m * G * S.a / L;
    const HWY = !!opts.highway, hwG = HWY ? 1.1 + Math.min(0.12, spd * 0.0012) : 1; // RD highway profile
    const g = this.surfaceGrip * hwG;
    const muF = S.muF * g * (1 - 0.1 * (Wf / Wf0 - 1)), muR = S.muR * g * (1 - 0.1 * (Wr / Wr0 - 1));
    const FmaxF = muF * Wf, FmaxR = muR * Wr;
    // --- スリップ角 ---
    const cd = Math.cos(delta), sd = Math.sin(delta);
    const fLat = -vx * sd + (vy + rDL * S.a) * cd, fLon = vx * cd + (vy + rDL * S.a) * sd;
    const aF = Math.atan2(fLat, Math.max(Math.abs(fLon), 2.5));
    const aR = Math.atan2(vy - rDL * S.b, vxe);
    this.slipF = aF; this.slipR = aR;
    let FyF = -FmaxF * tireCurve(aF, S.B, S.C), FyR = -FmaxR * tireCurve(aR, S.B, S.C);
    // --- 縦力（駆動・制動） ---
    const sgn = vx >= 0 ? 1 : -1;
    const driveR = S.driveR;
    let FxF = driveF * (1 - driveR), FxR = driveF * driveR;
    const bf = brake * S.brakeMax;
    const bias = s.setup?.brakeBias || 0.62;
    if (brake > 0 && Math.abs(vx) > 0.3) { FxF -= sgn * bf * bias; FxR -= sgn * bf * (1 - bias) * (S.lsd2way ? 1.15 : 1); }
    const hb = input.handbrake && Math.abs(vx) > 0.5;
    if (hb) { FxR = -sgn * FmaxR * 0.88; this.handOn = 1; } else this.handOn = 0;
    // 摩擦円
    const lim = (Fx, Fy, Fmax, driven) => {
      let spinT = 0; const cap = Fmax;
      if (Math.abs(Fx) > cap) { const over = Math.abs(Fx) / cap; Fx = Math.sign(Fx) * cap * 0.9; spinT = driven && Fx * sgn > 0 ? Math.min(1.6, (over - 1) * 0.7 + 0.25) : 0; }
      const fyLim = Math.sqrt(Math.max(0, cap * cap - Fx * Fx)) * (spinT > 0 ? (1.3 - 0.55 * S.lsd) : 1);
      Fy = clamp(Fy, -fyLim, fyLim); return [Fx, Fy, spinT];
    };
    // スロットルスライド: 後輪が滑っている時にアクセルを踏むとホイールスピンで横グリップが抜け、前に押し出す
    if (driveR > 0 && Math.abs(aR) > 0.12 && throttle > 0.25 && this.gear > 0 && !hb && vx > 3) {
      const pwr = clamp((S.hp * (this.powerFactor || 1) / (m / 1000)) / 190, 0.55, 1.35) * (0.65 + 0.6 * S.lsd);
      const k = clamp((Math.abs(aR) - 0.12) / 0.15, 0, 1) * throttle * driveR;
      FyR *= 1 - k * clamp(pwr * 0.42, 0.15, 0.55);
      FxR = Math.max(FxR, FmaxR * 0.72 * k * Math.min(1.1, pwr));
      this.spinR = Math.max(this.spinR || 0, k * 0.6);
    }
    let sT; [FxF, FyF, sT] = lim(FxF, FyF, FmaxF, driveR < 1); this.spinF = damp(this.spinF || 0, sT, sT > (this.spinF || 0) ? 8 : 4, dt);
    [FxR, FyR, sT] = lim(FxR, FyR, FmaxR, driveR > 0); this.spinR = damp(this.spinR || 0, sT, sT > (this.spinR || 0) ? 8 : 4, dt);
    // --- 合力 ---
    let Fx = FxF * cd - FyF * sd + FxR, Fy = FxF * sd + FyF * cd + FyR;
    const yawDamp = S.yawDamp + (HWY ? 0.06 + spd * 0.004 : 0);
    let torque = S.a * (FxF * sd + FyF * cd) - S.b * FyR - yawDamp * m * rDL * 0.4;
    if (assist > 0 && spd > 4) torque += assist * m * 9 * (beta - clamp(beta, -0.62, 0.62)) - (Math.abs(beta) > 0.7 ? assist * rDL * S.I * 0.6 : 0);
    if (easy > 0 && spd > 6 && vx > 0) {
      // EASY DRIFT: anti-spin — the angle limit closes in from 0.62 to ~0.5 rad (≈50°→30°) and pushes back harder
      const cap = 0.62 - 0.12 * easy;
      torque += easy * m * 14 * (beta - clamp(beta, -cap, cap));
      // speed keep: while sideways on the throttle, part of the tyre scrub is given back along the heading
      if (Math.abs(beta) > 0.18 && throttle > 0.3 && this.gear > 0) Fx += easy * m * 2.6 * throttle * Math.min(1, Math.abs(Math.sin(beta)) * 1.6);
    }
    // 空気抵抗・転がり
    const dragFx = -this.cda * spd * vx - S.roll * vx * 0.02 - Math.sign(vx) * Math.min(Math.abs(vx) * 30, S.roll * 9.0);
    const dragFy = -this.cda * spd * vy;
    Fx += dragFx; Fy += dragFy;
    const axL = Fx / m, ayL = Fy / m;
    this.axDL = axL; this.ayDL = ayL;
    // ワールド積分
    const vwx0 = this.vx, vwz0 = this.vz;
    this.vx += (axL * fwdX + ayL * rgtX) * dt; this.vz += (axL * fwdZ + ayL * rgtZ) * dt;
    rDL += torque / S.I * dt;
    // RD fix (the only change to DL's chassis maths): GRIP-RECOVERY STABILISER.
    // In DL the player's counter-steer is added on top of the automatic counter-steer, so while the car
    // unwinds from a slide the front tyres can keep pulling the nose round past the direction of travel and it
    // flips into a slide the OTHER way (tank-slapper). While |β| is shrinking, the yaw rate is blended toward the
    // rate at which the direction of travel itself turns, with a weight that grows only as β → 0. Result: the
    // nose meets the velocity and the car is back in grip, instead of overshooting. Entering / holding a drift
    // (|β| growing) is untouched.
    if (!opts.dlPure && assist > 0 && vx > 5) {
      const unwinding = rDL * beta > 0;                                       // heading rotating back toward the velocity
      if (unwinding) {
        const psi0 = Math.atan2(vwx0, vwz0), psi1 = Math.atan2(this.vx, this.vz);
        let dpsi = psi1 - psi0; dpsi -= Math.round(dpsi / (2 * Math.PI)) * 2 * Math.PI;
        const rTarget = -dpsi / dt;                                           // DL sign: + = turning right
        const w = clamp(1 - Math.abs(beta) / 0.3, 0, 1) * clamp(0.5 + assist, 0, 1.2);
        rDL += (rTarget - rDL) * Math.min(1, dt * 12 * w);
      }
    }
    // 低速安定化
    const nv = Math.hypot(this.vx, this.vz);
    if (nv < 0.6 && throttle < 0.05 && (brake > 0 || this.gear === 0 || input.handbrake)) { this.vx *= 0.8; this.vz *= 0.8; rDL *= 0.8; }
    if (nv < 1.5) rDL *= Math.exp(-dt * 6 * (1.5 - nv));
    if (opts.stable && Math.abs(vx) > 3) { // RD: CPU stability aid (AI drivers only)
      const k = Math.min(1, dt * opts.stable), latV = this.vx * rgtX + this.vz * rgtZ;
      this.vx -= rgtX * latV * k; this.vz -= rgtZ * latV * k; rDL += (vx * Math.tan(delta) / L - rDL) * k * 0.5;
    }
    rDL = clamp(rDL, -4, 4);
    this.yaw = heading - rDL * dt; this.r = -rDL;
    this.x += this.vx * dt; this.z += this.vz * dt;
    // 状態
    const fx2 = Math.sin(this.yaw), fz2 = Math.cos(this.yaw);
    this.u = this.vx * fx2 + this.vz * fz2; this.v = this.vx * fz2 - this.vz * fx2; // RD: v = LEFT
    this.vLat = -this.v;
    this.wF = this.u / R * (1 + this.spinF); this.wR = hb ? 0 : this.u / R * (1 + this.spinR);
    this.ax += (axL - this.ax) * Math.min(1, dt * 12); this.ay += (-ayL - this.ay) * Math.min(1, dt * 10); // RD ay: + = left
    this.axLag = this.axF;

    // ---- telemetry for HUD / audio / visuals --------------------------------------------------
    this.slipFront = Math.min(1, Math.max(0, Math.abs(aF) / 0.12 - 1.05) * 0.5);
    this.slipRear = Math.min(1, Math.max(0, Math.abs(aR) / 0.12 - 1.05) * 0.5);
    this.wheelspin = Math.min(1, Math.max(driveR > 0 ? this.spinR : 0, driveR < 1 ? this.spinF : 0) * 1.4);
    this.lockup = hb && Math.abs(vx) > 2 ? 1 : 0;
    this.driftAngle = spd > 5 ? -beta : 0; // RD sign: + = sliding to the LEFT of the nose
    this.wheelRotF += this.wF * dt; this.wheelRotR += this.wR * dt; this.wheelRot = this.wheelRotR;
    // 車体の姿勢（見た目） — DL pitch / roll
    this.pitch = damp(this.pitch, clamp(-axL * 0.006, -0.06, 0.06), 6, dt);
    this.roll = damp(this.roll, clamp(-ayL * 0.0075 * S.rollK, -0.07, 0.07), 6, dt);

    // ---- automatic gearbox: DL rule — no shifting while sideways (|β| ≥ 0.22) unless at the limiter / bogging
    if (auto && !shifting && this.gear > 0 && (Math.abs(beta) < 0.22 || this.rpm > e.redline * 0.985 || this.rpm < e.redline * 0.26)) {
      const n = s.gears.length;
      const up = this.gear < n && this.rpm > e.redline * 0.94 && this.spinR < 0.5 && this.spinF < 0.5;
      const dnRpm = this.gear > 1 ? Math.abs(vx) / R * this.gearRatio(this.gear - 1) * 60 / (2 * Math.PI) : 1e9;
      const dn = this.gear > 1 && dnRpm < e.redline * 0.86 && this.rpm < e.redline * (brake > 0.2 ? 0.58 : 0.4);
      if (up) this.shift(1); else if (dn) this.shift(-1);
    }
  }

  // wall contact: n = unit normal (x,z) pointing back to the road
  collide(nx, nz, depth, restitution = 0.25, friction = 0.35) {
    this.x += nx * depth; this.z += nz * depth;
    const vn = this.vx * nx + this.vz * nz;
    if (vn >= 0) return 0;
    const tx = -nz, tz = nx;
    let vt = this.vx * tx + this.vz * tz;
    const impact = -vn;
    vt *= Math.max(0, 1 - friction * Math.min(1, impact / 12));
    this.vx = tx * vt + nx * (-vn * restitution);
    this.vz = tz * vt + nz * (-vn * restitution);
    this.r *= Math.max(0.3, 1 - impact * 0.05);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const u = this.vx * sy + this.vz * cy; const R = this.spec.tire.radius;
    this.wF = u / R; if (impact > 4) this.wR = u / R;
    if (impact > 1.5) this.events.push({ type: 'hit', impact });
    return impact;
  }
}
