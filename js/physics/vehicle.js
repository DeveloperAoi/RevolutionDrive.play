// REVOLUTION DRIVE — vehicle dynamics v2 ("FIRST IGNITION")
// Two-axle model with explicit WHEEL SPEED states:
//  * each axle has an angular velocity ω; slip ratio κ = (ωR − u)/|u|
//  * combined slip: normalised (κ/κ*, tanα/tanα*) → one friction curve, force split by direction
//    (so wheelspin, lock-up and the handbrake all steal lateral grip *continuously*)
//  * engine inertia is reflected through the gearbox onto the driven axle: wheelspin raises revs
//  * longitudinal load transfer with chassis lag (brake → nose dives → rear goes light)
//  * implicit wheel integration (stable at 120 Hz even at walking pace)
// Conventions: world plane (x,z), y up. heading ψ: forward = (sinψ, cosψ).
// body frame: u = forward speed, v = speed to the LEFT, r = dψ/dt (+ = turning left).

const G = 9.81;
const K_PEAK = 0.11;     // slip ratio at peak longitudinal force
const A_PEAK = 0.13;     // slip angle (tan) at peak lateral force
const C_SHAPE = 1.5;     // curve shape: sliding friction ≈ sin(C·π/2) ≈ 0.71 of peak
const B_SHAPE = Math.tan(Math.PI / (2 * C_SHAPE)); // peak exactly at normalised slip 1
const mf = (s) => Math.sin(C_SHAPE * Math.atan(B_SHAPE * s));

export class Vehicle {
  constructor(spec) { this.setSpec(spec); this.reset(0, 0, 0, 0); }

  setSpec(spec) {
    this.spec = spec;
    const L = spec.wheelbase;
    this.a = L * (1 - spec.weightFront);
    this.b = L * spec.weightFront;
    this.inertia = spec.mass * L * L * 0.40;
    const tp = Math.max(...spec.engine.curve.map(p => p[1]));
    this.curve = spec.engine.curve.map(p => [p[0], p[1] / tp]);
    this.peakTorque = spec.engine.torque;
    this.susp = spec.suspensionLevel || 0;
    this.Iw = 2.6;                                  // two wheels + hubs, per axle (kg m²)
    this.Ie = 0.11 * (spec.engine.inertia || 1);     // crank + flywheel
    this.cda = 0.5 * 1.225 * (spec.cda || 0.68);
  }

  reset(x, y, z, yaw) {
    Object.assign(this, { x, y, z, yaw, vx: 0, vz: 0, vy: 0, r: 0, wF: 0, wR: 0 });
    this.gear = 1; this.rpm = this.spec.engine.idle; this.shiftTimer = 0; this.clutch = 1;
    this.steer = 0; this.boost = 0; this.u = 0; this.v = 0; this.ax = 0; this.ay = 0; this.axLag = 0;
    this.pitch = 0; this.roll = 0; this.pitchV = 0; this.rollV = 0;
    this.slipFront = 0; this.slipRear = 0; this.wheelspin = 0; this.lockup = 0;
    this.driftAngle = 0; this.wheelRot = 0; this.wheelRotF = 0; this.wheelRotR = 0; this.limiterHit = 0;
    this.surfaceGrip = 1; this.events = []; this.throttleIn = 0; this.load = 0; this.decel = 0;
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
    const s = this.spec, e = s.engine, m = s.mass, L = s.wheelbase, R = s.tire.radius;
    const assist = opts.driftAssist ?? 0.6;
    const auto = opts.autoGear ?? true;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let u = this.vx * sy + this.vz * cy;
    let v = this.vx * cy - this.vz * sy;
    const speed = Math.hypot(u, v);
    const beta = speed > 3 ? Math.atan2(v, Math.abs(u)) : 0;
    let throttle = input.throttle, brake = input.brake;
    const hb = input.handbrake && Math.abs(u) > 0.5;

    // ---- steering: speed-sensitive lock + counter-steer assist ------------------------------
    const muEst = s.tire.grip * (this.surfaceGrip || 1);
    const gripLock = L * muEst * G / Math.max(1, u * u) + 0.06 + (1 - assist) * 0.06;
    const lock = Math.min(s.steerLock, gripLock);
    let target = -input.steer * lock * (s.setup?.steerSens || 1);
    if (assist > 0 && u > 5 && Math.abs(beta) > 0.06) {
      // while sliding the front wheels may point along the direction of travel (counter-steer)
      const along = Math.max(-s.steerLock, Math.min(s.steerLock, beta * 0.9));
      const neutral = Math.abs(input.steer) < 0.12;
      const counter = Math.sign(input.steer) === -Math.sign(beta); // input.steer + = right; beta + = sliding left
      if (neutral) target = along * assist;
      else if (counter) target = Math.sign(target) * Math.max(Math.abs(target), Math.abs(along) * (0.6 + assist * 0.4));
    }
    target = Math.max(-s.steerLock, Math.min(s.steerLock, target));
    const steerRate = 3.4 + assist * 2 + (s.steerResp || 0) * 0.3;
    this.steer += Math.max(-steerRate * dt, Math.min(steerRate * dt, target - this.steer));
    const delta = this.steer;

    // ---- gearbox: auto reverse / auto shifting ----------------------------------------------
    if (this.shiftTimer > 0) this.shiftTimer -= dt;
    const shifting = this.shiftTimer > 0;
    if (auto) {
      if (this.gear > 0 && u < 0.5 && brake > 0.5 && throttle < 0.1) { this.gear = -1; }
      else if (this.gear < 0 && throttle > 0.3 && u > -0.5 && brake < 0.1) { this.gear = 1; }
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

    // ---- normal loads (with chassis lag on longitudinal transfer) ------------------------
    this.axLag += (this.ax - this.axLag) * Math.min(1, dt / 0.11);
    const h = s.cgHeight;
    const down = (s.downforce || 0) * u * u * 0.9;
    let Fzf = m * G * (this.b / L) + down * 0.45 - m * this.axLag * h / L;
    let Fzr = m * G * (this.a / L) + down * 0.55 + m * this.axLag * h / L;
    Fzf = Math.max(m * G * 0.1, Fzf); Fzr = Math.max(m * G * 0.1, Fzr);
    const latT = Math.min(0.45, Math.abs(this.ay) * h / (s.body.wid * 0.85) / G);
    const sensF = 1 - latT * (0.20 - this.susp * 0.025);
    const sensR = 1 - latT * (0.17 - this.susp * 0.025);
    const mu = s.tire.grip * this.surfaceGrip;
    const trc = s.traction || 0;
    const muF = mu * 1.0 * sensF;
    const muR = mu * (1.04 - (s.setup?.camber || 0) * 0.03) * sensR;

    // ---- slip angles -------------------------------------------------------------------------
    const uu = Math.max(Math.abs(u), 1.5), sgn = u >= 0 ? 1 : -1;
    const tanAF = (v + this.a * this.r) / uu - Math.tan(delta) * sgn;
    const tanAR = (v - this.b * this.r) / uu;

    // ---- per-axle combined-slip tyre force, with implicit wheel-speed integration ---------------
    const bias = s.setup?.brakeBias || 0.63;
    const brakeT = m * G * 1.2 * s.brake * brake * R;   // total brake torque available
    const axle = (w, Fz, muA, tanA, Tdrive, Tbrake, Iax, driven, abs) => {
      const cap = muA * Fz * (driven && Tdrive > 0 ? 1 + trc * 0.02 : 1);
      const force = (ww) => {
        const kap = (ww * R - u) / uu;
        const sx = kap / K_PEAK, syn = tanA / A_PEAK;
        const sn = Math.hypot(sx, syn) || 1e-6;
        const F = cap * mf(sn);
        return [F * sx / sn, -F * syn / sn, kap, sn];
      };
      const [fx0] = force(w);
      const eps = 0.05; const [fx1] = force(w + eps);
      const kF = Math.max(0, (fx1 - fx0) / eps);          // dFx/dω (for implicit step)
      let w1 = w + dt * (Tdrive - fx0 * R) / (Iax + dt * kF * R);
      // brakes: drive ω toward zero but never through it (lock = sliding)
      if (Tbrake > 0 && abs && u > 3 && (w * R - u) / uu < -K_PEAK * 1.4) Tbrake *= 0.35;
      if (Tbrake > 0) { const dw = Tbrake * dt / Iax; w1 = Math.abs(w1) <= dw ? 0 : w1 - Math.sign(w1) * dw; }
      const [Fx, Fy, kap, sn] = force(w1);
      return { w: w1, Fx, Fy, kap, sn };
    };
    const reflect = this.clutch > 0.5 ? this.Ie * ratio * ratio : 0;
    const IF = this.Iw + reflect * split, IR = this.Iw + reflect * (1 - split);
    let TdF = Taxle * split, TdR = Taxle * (1 - split);
    // traction assist: limit wheelspin (looser when the assist is low, so power-oversteer stays possible)
    if (assist > 0) {
      const maxK = K_PEAK * (1.2 + (1 - assist) * 7);
      const kR = (this.wR * R - u) / uu, kF = (this.wF * R - u) / uu;
      if (TdR > 0 && kR > maxK) TdR *= Math.max(0.15, 1 - (kR - maxK) * 4);
      if (TdF > 0 && kF > maxK) TdF *= Math.max(0.15, 1 - (kF - maxK) * 4);
    }
    const absOn = assist > 0;
    const hbT = hb ? 1500 * (1 - assist * 0.4) : 0;   // handbrake: strong but not a dead lock with assist
    const fr = axle(this.wF, Fzf, muF, tanAF, TdF, brakeT * bias, IF, split > 0, absOn);
    const rr = axle(this.wR, Fzr, muR, tanAR, TdR, brakeT * (1 - bias) + hbT, IR, split < 1, absOn && !hb);
    this.wF = fr.w; this.wR = rr.w;

    // ---- body forces -----------------------------------------------------------------------
    const cd = Math.cos(delta), sd = Math.sin(delta);
    const resist = Math.sign(u) * (0.013 * m * G + this.cda * u * u);
    let Fx = rr.Fx + fr.Fx * cd - fr.Fy * sd - resist;
    let Fy = rr.Fy + fr.Fy * cd + fr.Fx * sd;
    let Mz = this.a * (fr.Fy * cd + fr.Fx * sd) - this.b * rr.Fy;

    // ---- arcade layer (scaled by DRIFT ASSIST) ------------------------------------------------
    const ab = Math.abs(beta);
    if (assist > 0 && u > 6) {
      // soft angle limit around 50° and yaw damping once the car is clearly sliding
      // beta grows while the nose rotates away from the travel direction: r and beta have opposite signs
      const growing = this.r * beta < 0;
      if (ab > 0.15) Mz -= this.r * this.inertia * (growing ? 0.6 + Math.max(0, ab - 0.42) * 14 : 0.35) * assist * Math.min(1, (ab - 0.15) * 3);
      // keep a little momentum in a held drift so slides feel rewarding rather than draggy
      if (ab > 0.12 && throttle > 0.3) Fx += m * 1.1 * assist * throttle * Math.min(1, (ab - 0.12) * 3);
    }
    if (s.stability && u > 5) Mz -= this.r * this.inertia * 0.010 * s.stability * Math.min(1, ab * 4 + 0.2);

    // ---- integrate --------------------------------------------------------------------------
    const axB = Fx / m, ayB = Fy / m;
    u += (axB + v * this.r) * dt;
    v += (ayB - u * this.r) * dt;
    this.r += (Mz / this.inertia) * dt;
    if (Math.abs(u) < 2.5) { // low speed: kinematic blend (no jitter when parking)
      const k = 1 - Math.abs(u) / 2.5;
      this.r += (u * Math.tan(delta) / L - this.r) * k * Math.min(1, dt * 12);
      v *= 1 - k * Math.min(1, dt * 10);
      if (Math.abs(u) < 0.08 && throttle < 0.05) { u *= 0.85; this.wF *= 0.85; this.wR *= 0.85; }
    }
    if (opts.stable && Math.abs(u) > 3) { // CPU stability aid
      const k = Math.min(1, dt * opts.stable);
      v -= v * k; this.r += (u * Math.tan(delta) / L - this.r) * k * 0.5;
    }
    this.ax += (axB - this.ax) * Math.min(1, dt * 12);
    this.ay += (ayB - this.ay) * Math.min(1, dt * 10);
    this.vx = u * sy + v * cy; this.vz = u * cy - v * sy;
    this.x += this.vx * dt; this.z += this.vz * dt; this.yaw += this.r * dt;
    this.u = u; this.v = v;

    // ---- telemetry for HUD / audio / visuals --------------------------------------------------
    this.slipFront = Math.min(1, Math.max(0, fr.sn - 1.05) * 0.8);
    this.slipRear = Math.min(1, Math.max(0, rr.sn - 1.05) * 0.8);
    const kapD = Math.max(split < 1 ? rr.kap : 0, split > 0 ? fr.kap : 0);
    this.wheelspin = kapD > K_PEAK * 1.5 ? Math.min(1, kapD * 2) : 0;
    this.lockup = (rr.w === 0 || fr.w === 0) && Math.abs(u) > 2 ? 1 : 0;
    this.driftAngle = speed > 5 ? beta : 0;
    this.wheelRotF += this.wF * dt; this.wheelRotR += this.wR * dt; this.wheelRot = this.wheelRotR;
    // visual suspension
    const k = 95 + this.susp * 30 + (s.setup?.stiffness || 0) * 30, c = 15 + this.susp * 2;
    const pitchT = Math.max(-0.05, Math.min(0.05, -this.axLag * 0.006)), rollT = Math.max(-0.055, Math.min(0.055, this.ay * 0.0065 * (1 - this.susp * 0.15)));
    this.pitchV += ((pitchT - this.pitch) * k - this.pitchV * c) * dt; this.pitch += this.pitchV * dt;
    this.rollV += ((rollT - this.roll) * k - this.rollV * c) * dt; this.roll += this.rollV * dt;

    // ---- automatic gearbox (after the step so it sees fresh revs) ---------------------------
    if (auto && !shifting && this.gear > 0) {
      const n = s.gears.length;
      if (this.rpm > e.redline * 0.97 && this.gear < n && throttle > 0.2 && this.wheelspin < 0.5) this.shift(1);
      else if (this.gear > 1) {
        const lower = Math.abs(Math.max(Math.abs(wDrive), Math.abs(u) / R) * this.gearRatio(this.gear - 1)) * 60 / (2 * Math.PI);
        const downAt = brake > 0.3 ? e.redline * 0.74 : throttle > 0.3 ? e.redline * 0.55 : e.redline * 0.42;
        if (lower < downAt && this.rpm < e.redline * (throttle > 0.3 ? 0.55 : 0.36)) this.shift(-1);
      }
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
