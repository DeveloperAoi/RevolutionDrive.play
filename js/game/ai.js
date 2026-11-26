// CPU driver: follows a curvature-derived racing line, plans braking from the
// curvature ahead, and drives with exactly the same physics as the player.
export class AIDriver {
  constructor(track, skill = 0.9, aggression = 0.5) {
    this.t = track; this.skill = skill; this.aggr = aggression; this.hint = -1; this.stuck = 0;
  }
  lineAt(s) {
    // average curvature around s -> lateral offset toward the inside of corners
    const t = this.t; let k = 0;
    for (let o = -10; o <= 30; o += 5) k += t.pointAt(s + o).k;
    k /= 9;
    const hw = t.pointAt(s).i >= 0 ? t.w[t.pointAt(s).i] / 2 : 4;
    return Math.max(-1, Math.min(1, k * 70)) * (hw - 1.4);
  }
  control(v, grip, dt) {
    const t = this.t;
    const pr = t.project(v.x, v.z, this.hint, v.y); this.hint = pr.i;
    const speed = v.speed;
    // target speed from curvature ahead
    const mu = v.spec.tire.grip * grip * this.skill;
    let target = 75;
    for (let d = 5; d < 160; d += 5) {
      const k = Math.abs(t.pointAt(pr.s + d).k) + 1e-4;
      const vmax = Math.sqrt(mu * 9.81 * 0.8 / k) * (0.94 + this.aggr * 0.08);
      const allow = Math.sqrt(vmax * vmax + 2 * 6.5 * mu * d);
      target = Math.min(target, allow);
    }
    // steering: pure pursuit to a point on the racing line
    const look = 5 + speed * 0.42;
    const p = t.pointAt(pr.s + look, this.lineAt(pr.s + look));
    const dx = p.x - v.x, dz = p.z - v.z;
    const want = Math.atan2(dx, dz);
    let err = want - v.yaw; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    // add drift-angle correction (counter-steer)
    let steer = -err * 2.2 - (v.driftAngle || 0) * 0.5;
    steer = Math.max(-1, Math.min(1, steer));
    let throttle = 0, brake = 0;
    if (speed < target - 1.5) throttle = 1; else if (speed > target + 2.5) brake = Math.min(1, (speed - target) / 6); else throttle = 0.45;
    if (Math.abs(err) > 0.6 && speed > 12) { throttle *= 0.4; }
    const ab = Math.abs(v.driftAngle || 0);
    if (ab > 0.22) throttle = Math.min(throttle, 0.35);
    if (ab > 0.45) { throttle = 0; }
    // stuck recovery
    if (speed < 1.5) this.stuck += dt; else this.stuck = 0;
    const reverse = this.stuck > 2.5 && this.stuck < 4.5;
    if (this.stuck > 4.5) this.stuck = 0;
    if (reverse) return { steer: -steer, throttle: 0, brake: 1, handbrake: false };
    return { steer, throttle, brake, handbrake: false, s: pr.s, tgt: target };
  }
}
