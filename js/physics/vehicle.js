// REVOLUTION DRIVE — vehicle dynamics
// Planar two-axle model with:
//  * Pacejka-style lateral tyre curves per axle
//  * longitudinal + lateral load transfer from the centre of gravity height
//  * friction circle (combined slip) so throttle / brake / handbrake steal lateral grip
//  * torque-curve engine, clutch slip, gearbox (auto / manual), engine braking, rev limiter
//  * FR / FF / 4WD drive split
//  * surface grip (asphalt / wet / gravel)
// Conventions: world plane is (x, z), y is up. heading ψ: forward = (sinψ, cosψ).
// Body frame: u = forward speed, v = speed to the LEFT. r = dψ/dt (positive = turning left).

const G = 9.81;
const RHO_CDA = 0.5 * 1.225 * 0.68;

export class Vehicle {
  constructor(spec) {
    this.setSpec(spec);
    this.reset(0, 0, 0, 0);
  }

  setSpec(spec) {
    this.spec = spec;
    const L = spec.wheelbase;
    this.a = L * (1 - spec.weightFront); // cg -> front axle
    this.b = L * spec.weightFront;       // cg -> rear axle
    this.inertia = spec.mass * (L * L) * 0.42;
    const tp = Math.max(...spec.engine.curve.map(p => p[1]));
    this.curve = spec.engine.curve.map(p => [p[0], p[1] / tp]);
    this.peakTorque = spec.engine.torque;
    this.susp = spec.suspensionLevel || 0;
  }

  reset(x, y, z, yaw) {
    this.x = x; this.y = y; this.z = z; this.yaw = yaw;
    this.vx = 0; this.vz = 0; this.vy = 0; this.r = 0;
    this.gear = 1; this.rpm = this.spec.engine.idle; this.shiftTimer = 0; this.clutch = 1;
    this.steer = 0; this.boost = 0;
    this.u = 0; this.v = 0; this.ax = 0; this.ay = 0;
    this.pitch = 0; this.roll = 0; this.pitchV = 0; this.rollV = 0;
    this.slipFront = 0; this.slipRear = 0; this.wheelspin = 0; this.lockup = 0;
    this.driftAngle = 0; this.wheelRot = 0; this.limiterHit = 0;
    this.surfaceGrip = 1; this.offroad = 0;
    this.lastShift = 0; this.events = [];
  }

  get speed() { return Math.hypot(this.vx, this.vz); }
  get kmh() { return this.speed * 3.6; }

  torqueAt(rpm) {
    const c = this.curve;
    if (rpm <= c[0][0]) return c[0][1];
    for (let i = 1; i < c.length; i++) {
      if (rpm <= c[i][0]) {
        const t = (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]);
        return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t;
      }
    }
    return c[c.length - 1][1] * 0.6;
  }

  gearRatio(g = this.gear) {
    if (g === 0) return 0;
    if (g < 0) return -this.spec.reverse * this.spec.final;
    return this.spec.gears[g - 1] * this.spec.final;
  }

  shift(dir) {
    const n = this.spec.gears.length;
    const ng = Math.max(-1, Math.min(n, this.gear + dir));
    if (ng === this.gear) return;
    if (ng === 0) { this.gear = dir > 0 ? 1 : -1; } else this.gear = ng;
    if (this.gear === 0) this.gear = dir > 0 ? 1 : -1;
    this.shiftTimer = this.spec.shiftTime || 0.2;
    this.events.push({ type: 'shift', dir, gear: this.gear });
  }

  // tyre lateral force curve (normalised): returns fraction of peak
  static lat(alpha, B, C) {
    return Math.sin(C * Math.atan(B * alpha));
  }

  step(dt, input, opts = {}) {
    const s = this.spec, e = s.engine;
    const m = s.mass;
    const L = s.wheelbase;
    const assist = opts.driftAssist ?? 0.6;
    const auto = opts.autoGear ?? true;

    // ---- body frame velocities
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let u = this.vx * sy + this.vz * cy;
    let v = this.vx * cy - this.vz * sy;
    const speed = Math.hypot(u, v);

    // ---- steering (input.steer: + = right)  -> delta (+ = left)
    const beta = speed > 3 ? Math.atan2(v, Math.abs(u)) : 0; // body slip angle
    // speed-sensitive lock: at speed full input asks for roughly the grip limit (+ a little
    // extra so the player can still provoke a slide); at low speed the full steering lock.
    const muEst = s.tire.grip * (this.surfaceGrip || 1);
    const gripLock = s.wheelbase * muEst * G / Math.max(1, u * u) + 0.10 + (1 - assist) * 0.05;
    let maxLock = Math.min(s.steerLock, gripLock);
    let target = -input.steer * maxLock * (s.setup?.steerSens || 1);
    // counter-steer assist: during a slide, the wheel is allowed to point along the travel direction
    if (assist > 0 && Math.abs(beta) > 0.08 && u > 5) {
      const counter = Math.sign(target) === Math.sign(beta) || Math.abs(input.steer) < 0.1;
      const aid = Math.min(Math.abs(beta), s.steerLock) * assist;
      if (counter) target += Math.sign(beta) * aid * (Math.abs(input.steer) < 0.1 ? 0.85 : 0.5);
    }
    target = Math.max(-s.steerLock, Math.min(s.steerLock, target));
    const steerRate = 3.2 + assist * 2 + (s.steerResp || 0) * 0.3;
    this.steer += Math.max(-steerRate * dt, Math.min(steerRate * dt, target - this.steer));
    const delta = this.steer;

    // ---- engine & drivetrain
    if (this.shiftTimer > 0) this.shiftTimer -= dt;
    const shifting = this.shiftTimer > 0;
    const R = s.tire.radius;
    let throttle = input.throttle, brake = input.brake;

    // reverse handling: brake held while (nearly) stopped engages reverse; throttle returns to 1st
    if (auto) {
      if (this.gear > 0 && u < 0.6 && brake > 0.5 && throttle < 0.1) { this.gear = -1; }
      else if (this.gear < 0 && throttle > 0.3 && u > -0.6 && brake < 0.1) { this.gear = 1; }
      if (this.gear < 0) { const t = throttle; throttle = brake; brake = t; }
    } else if (this.gear < 0) { /* manual reverse: throttle drives backwards */ }

    const ratio = this.gearRatio();
    const wheelRpm = (u / R) * 60 / (2 * Math.PI);
    let rpmFromWheels = Math.abs(wheelRpm * ratio);
    // clutch slip at launch
    const launchRpm = e.idle + throttle * (e.redline * (0.42 + (s.launch || 0) * 0.03));
    let engRpm;
    if (this.gear === 0 || shifting) {
      engRpm = this.rpm + ((shifting ? rpmFromWheels : e.idle + throttle * e.redline) - this.rpm) * Math.min(1, dt * 12);
      this.clutch = 0;
    } else if (rpmFromWheels < launchRpm && Math.abs(this.gear) === 1) {
      engRpm = Math.max(rpmFromWheels, launchRpm); this.clutch = rpmFromWheels / launchRpm;
    } else { engRpm = rpmFromWheels; this.clutch = 1; }
    // wheelspin lets revs flare
    if (this.wheelspin > 0.05 && !shifting) engRpm = Math.max(engRpm, Math.min(e.limiter, rpmFromWheels + this.wheelspin * throttle * 3500));
    engRpm = Math.max(e.idle * (0.9 + Math.random() * 0.02), engRpm);
    // limiter
    let cut = false;
    if (engRpm >= e.limiter) { engRpm = e.limiter; cut = true; this.limiterHit = 0.08; }
    if (this.limiterHit > 0) { this.limiterHit -= dt; if (this.limiterHit > 0.04) cut = true; }
    this.rpm += (engRpm - this.rpm) * Math.min(1, dt * 25 / e.inertia);

    // turbo boost lag
    if (s.sound.turbo) {
      const want = throttle > 0.4 ? Math.min(1, (this.rpm - e.idle) / (e.redline * 0.45)) : 0;
      const prev = this.boost;
      this.boost += (want - this.boost) * Math.min(1, dt * (want > this.boost ? 1.6 * (s.boostRate || 1) : 6));
      if (prev > 0.6 && throttle < 0.2 && this.boost < prev - 0.05 && !this._bov) { this.events.push({ type: 'bov', amt: prev }); this._bov = true; }
      if (throttle > 0.5) this._bov = false;
    } else this.boost = 1;

    const torqueFrac = this.torqueAt(this.rpm) * (s.sound.turbo ? 0.62 + 0.38 * this.boost : 1);
    let engineTorque = (cut || shifting) ? 0 : torqueFrac * this.peakTorque * throttle * (this.powerFactor || 1);
    // engine braking
    if (throttle < 0.05 && !shifting && this.gear !== 0) engineTorque -= this.peakTorque * 0.18 * (this.rpm / e.redline);
    let driveForce = engineTorque * ratio * 0.86 / R * (this.gear === 0 ? 0 : 1) * Math.max(0.35, this.clutch);

    // auto gearbox
    if (auto && !shifting && this.gear > 0) {
      const n = s.gears.length;
      const upAt = e.redline * 0.97;
      if (this.rpm > upAt && this.gear < n && throttle > 0.2 && this.wheelspin < 0.6) this.shift(1);
      else if (this.gear > 1) {
        const lowerRpm = Math.abs(wheelRpm * this.gearRatio(this.gear - 1));
        const downAt = brake > 0.3 ? e.redline * 0.72 : e.redline * 0.5;
        if (lowerRpm < downAt && this.rpm < e.redline * 0.55) this.shift(-1);
      }
    }

    // ---- normal loads with longitudinal transfer
    const h = s.cgHeight;
    const downF = s.downforce * u * u * 0.9;
    let Fzf = m * G * (this.b / L) + downF * 0.45 - m * this.ax * h / L;
    let Fzr = m * G * (this.a / L) + downF * 0.55 + m * this.ax * h / L;
    Fzf = Math.max(m * G * 0.12, Fzf); Fzr = Math.max(m * G * 0.12, Fzr);
    // lateral transfer reduces total axle capacity (tyre load sensitivity)
    const latT = Math.min(0.4, Math.abs(this.ay) * h / (s.body.wid * 0.85) / G);
    const sensF = 1 - latT * (0.22 - this.susp * 0.03);
    const sensR = 1 - latT * (0.18 - this.susp * 0.03);

    const mu = s.tire.grip * this.surfaceGrip;
    const muF = mu * 1.02 * sensF;
    const muR = mu * (1.0 - (s.setup?.camber || 0) * 0.04) * sensR;

    // ---- slip angles
    const uu = Math.max(Math.abs(u), 2.5);
    const sgn = u >= 0 ? 1 : -1;
    const alphaF = Math.atan2(v + this.a * this.r, uu) - delta * sgn;
    const alphaR = Math.atan2(v - this.b * this.r, uu);

    // ---- longitudinal demands per axle
    let split = s.drive === 'FF' ? 1 : s.drive === 'FR' ? 0 : (s.split ?? 0.4);
    // traction assist (part of the driving assist): caps drive force near the driven-axle grip
    if (assist > 0 && driveForce > 0) {
      const capDrive = (split >= 1 ? mu * 1.02 * Fzf0(this, m, L, h) : split <= 0 ? mu * Fzr0(this, m, L, h) : mu * m * G) * (1 + (1 - assist) * 0.7);
      driveForce = Math.min(driveForce, capDrive);
    }
    let FxF = driveForce * split, FxR = driveForce * (1 - split);
    // brakes
    const bias = s.setup?.brakeBias || 0.62;
    const brakeMax = m * G * 1.15 * s.brake * brake;
    if (Math.abs(u) > 0.3) {
      FxF -= Math.sign(u) * brakeMax * bias;
      FxR -= Math.sign(u) * brakeMax * (1 - bias);
    } else if (brake > 0 && this.gear >= 0) { u *= 0.9; v *= 0.9; }
    // rolling resistance + aero drag
    const resist = Math.sign(u) * (0.014 * m * G + RHO_CDA * u * u);

    // handbrake locks the rear axle
    const hb = input.handbrake ? 1 : 0;
    const capF = muF * Fzf, capR = muR * Fzr;
    if (hb && Math.abs(u) > 1) FxR = -Math.sign(u) * capR * 0.85;

    // ---- friction circle
    const B = 9.5 + this.susp * 0.6, C = 1.45;
    let FyF = -capF * Vehicle.lat(alphaF, B, C);
    let FyR = -capR * 1.04 * Vehicle.lat(alphaR, B * 0.95, 1.32);

    const satF = Math.abs(FxF) / capF, satR = Math.abs(FxR) / capR;
    let spinR = 0, spinF = 0;
    if (satF > 1) { spinF = Math.min(1, satF - 1); FxF = Math.sign(FxF) * capF * 0.92; }
    if (satR > 1) { spinR = Math.min(1, satR - 1); FxR = Math.sign(FxR) * capR * 0.92; }
    const latLeftF = Math.sqrt(Math.max(0, 1 - Math.min(1, (FxF / capF) ** 2)));
    const latLeftR = Math.sqrt(Math.max(0, 1 - Math.min(1, (FxR / capR) ** 2)));
    FyF *= Math.max(0.28, latLeftF) * (spinF > 0 ? 0.8 : 1);
    const trc = s.traction || 0;
    FyR *= Math.max(hb ? 0.30 : 0.36 + trc * 0.04, latLeftR) * (spinR > 0 ? 0.82 + trc * 0.03 : 1);
    this.wheelspin = (driveForce > 0 ? Math.max(spinR * (1 - split), spinF * split) : 0);
    this.lockup = brake > 0.2 && (satF > 1 || satR > 1) ? 1 : (hb && Math.abs(u) > 2 ? 1 : 0);

    // ---- sum forces in body frame
    const cd = Math.cos(delta), sd = Math.sin(delta);
    let Fx = FxR + FxF * cd - FyF * sd - resist;
    let Fy = FyR + FyF * cd + FxF * sd;
    let Mz = this.a * (FyF * cd + FxF * sd) - this.b * FyR;

    // arcade drift assist: damp spins, sustain angle, keep speed through a slide
    const absBeta = Math.abs(beta);
    // chassis stability (diff / rigidity / roll bar tuning) damps yaw once the car slides
    if (s.stability && u > 5) Mz -= this.r * this.inertia * 0.012 * s.stability * Math.min(1, absBeta * 4 + 0.2);
    if (assist > 0 && u > 10 && absBeta < 0.12 && !input.handbrake) Mz -= this.r * this.inertia * 0.12 * assist * Math.min(1, u / 30);
    if (assist > 0 && u > 6) {
      if (absBeta > 0.12) {
        // stop the car from swapping ends: progressive restoring yaw moment beyond ~45°
        const over = Math.max(0, absBeta - 0.75);
        Mz -= Math.sign(beta) * -over * this.inertia * 6 * assist;
        Mz -= this.r * this.inertia * 0.35 * assist * Math.min(1, absBeta * 2);
        // maintain momentum in drifts with throttle
        Fx += throttle * m * 0.9 * assist * Math.min(1, absBeta * 2.2);
      }
    }

    // ---- integrate (semi-implicit)
    const axB = Fx / m, ayB = Fy / m;
    u += (axB + v * this.r) * dt;
    v += (ayB - u * this.r) * dt;
    this.r += (Mz / this.inertia) * dt;

    // low speed: blend toward kinematic model to avoid jitter
    if (Math.abs(u) < 3) {
      const k = 1 - Math.abs(u) / 3;
      const rKin = u * Math.tan(delta) / L;
      this.r += (rKin - this.r) * k * Math.min(1, dt * 12);
      v *= 1 - k * Math.min(1, dt * 10);
    }
    if (Math.abs(u) < 0.05 && throttle < 0.05 && brake < 0.05) u *= 0.9;
    // CPU stability aid: bleed lateral slide and pull yaw toward the kinematic rate
    if (opts.stable && Math.abs(u) > 3) {
      const k = Math.min(1, dt * opts.stable);
      v -= v * k;
      const rKin = u * Math.tan(delta) / L;
      this.r += (rKin - this.r) * k * 0.5;
    }

    this.ax += (axB - this.ax) * Math.min(1, dt * 10);
    this.ay += (ayB - this.ay) * Math.min(1, dt * 10);

    // back to world
    this.vx = u * sy + v * cy;
    this.vz = u * cy - v * sy;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.yaw += this.r * dt;
    this.u = u; this.v = v;

    this.slipFront = Math.min(1, Math.max(0, Math.abs(alphaF) - 0.08) * 3 + spinF + (this.lockup && brake > .2 ? .6 : 0));
    this.slipRear = Math.min(1, Math.max(0, Math.abs(alphaR) - 0.07) * 3 + spinR + (hb && Math.abs(u) > 2 ? .7 : 0));
    this.driftAngle = speed > 5 ? beta : 0;
    this.wheelRot += (this.wheelspin > 0.1 ? u + this.wheelspin * 25 * Math.sign(this.gear) : u) / R * dt;

    // ---- visual suspension (spring-damper on pitch / roll)
    const k = 90 + this.susp * 35 + (s.setup?.stiffness || 0) * 30, c = 11 + this.susp * 2;
    const pitchT = -this.ax * 0.0085, rollT = this.ay * 0.011 * (1 - this.susp * 0.18);
    this.pitchV += ((pitchT - this.pitch) * k - this.pitchV * c) * dt; this.pitch += this.pitchV * dt;
    this.rollV += ((rollT - this.roll) * k - this.rollV * c) * dt; this.roll += this.rollV * dt;
  }

  // impulse response for wall contact. n = unit normal (x,z) pointing back toward the road
  collide(nx, nz, depth, restitution = 0.25, friction = 0.35) {
    this.x += nx * depth; this.z += nz * depth;
    const vn = this.vx * nx + this.vz * nz;
    if (vn >= 0) return 0;
    const tx = -nz, tz = nx;
    let vt = this.vx * tx + this.vz * tz;
    const impact = -vn;
    vt *= Math.max(0, 1 - friction * Math.min(1, impact / 12));
    const vnNew = -vn * restitution;
    this.vx = tx * vt + nx * vnNew;
    this.vz = tz * vt + nz * vnNew;
    // scrub yaw on impact
    this.r *= Math.max(0.3, 1 - impact * 0.05);
    if (impact > 1.5) this.events.push({ type: 'hit', impact });
    return impact;
  }
}

function Fzf0(v, m, L, h) { return Math.max(m * G * 0.12, m * G * (v.b / L) - m * v.ax * h / L); }
function Fzr0(v, m, L, h) { return Math.max(m * G * 0.12, m * G * (v.a / L) + m * v.ax * h / L); }
