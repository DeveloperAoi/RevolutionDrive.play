// REVOLUTION DRIVE — race session: world, cars, physics loop, rules, camera, ghost, HUD
import * as THREE from 'three';
import { Track } from '../world/track.js';
import { buildWorld } from '../world/scenery.js';
import { createCar } from '../world/carModel.js';
import { Vehicle } from '../physics/vehicle.js';
import { AIDriver } from './ai.js';
import { Audio } from '../audio/audio.js';
import { Input } from '../core/input.js';
import { courseById } from '../data/courses.js';
import { MUFFLERS } from '../data/cars.js';
import { Tacho, MiniMap, fmt, fmtDelta } from './hud.js';

const DT = 1 / 120;
const CAR_HALF_W = 0.85;

export class Race {
  constructor(gfx, cfg) {
    this.gfx = gfx; this.cfg = cfg;
    this.def = courseById(cfg.courseId);
    this.track = new Track(this.def, cfg.dir || 'fwd');
    this.laps = this.track.closed ? (cfg.laps || this.def.laps || 2) : 1;
    this.totalLen = this.track.length * this.laps;
    this.scene = new THREE.Scene();
    this.world = buildWorld(this.track, { time: cfg.time, weather: cfg.weather });
    this.scene.add(this.world.root); this.scene.fog = this.world.fog;
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 6000);
    this.cars = [];
    this.state = 'intro'; this.clock = 0; this.raceTime = 0; this.acc = 0; this.paused = false;
    this.camMode = cfg.settings?.camera || 0;
    this.attract = cfg.mode === 'attract';
    this.ghostRec = []; this.ghostT = 0;
    this.sections = []; this.secIdx = 0;
    this.hud = cfg.hud || null;
    this.autoGear = cfg.settings?.autoGear ?? true;
    this.assist = (cfg.settings?.assist ?? 6) / 10;

    // spawn
    const grid = [];
    if (cfg.player) grid.push({ ...cfg.player, ctrl: 'player' });
    for (const r of cfg.rivals || []) grid.push({ ...r, ctrl: 'ai' });
    const n = grid.length;
    grid.forEach((g, k) => {
      const lane = n === 1 ? 0 : (k % 2 === 0 ? -1.9 : 1.9);
      const back = Math.floor(k / 2) * 9;
      const p = this.track.pointAt(this.track.closed ? this.track.length - 1.5 - back : Math.max(1, 13 - back), lane);
      const veh = new Vehicle(g.spec);
      veh.reset(p.x, p.y, p.z, p.yaw);
      const model = createCar(g.spec, g.dress, { headlights: g.ctrl === 'player' || (this.attract && k < 2) });
      this.scene.add(model.root);
      const mu = MUFFLERS.find(m => m.id === g.dress?.muffler);
      const car = {
        ...g, veh, model, hint: -1, prog: 0, lastS: null, lap: 0, finished: false, finishTime: null,
        ai: g.ctrl === 'ai' ? new AIDriver(this.track, g.skill ?? 0.9, g.aggr ?? 0.5) : null,
        engine: Audio.createEngine(g.spec, { player: g.ctrl === 'player', muffler: mu ? mu.loud : 0 }),
        surfY: p.y, pitch: 0, roll: 0, wrong: 0, stuck: 0, offroad: 0, color: g.ctrl === 'player' ? '#ffd400' : '#ff3b3b',
      };
      this.cars.push(car);
    });
    this.player = this.cars.find(c => c.ctrl === 'player') || null;
    this.focus = this.player || this.cars[0];

    // ghost
    this.ghost = null;
    if (cfg.ghost && cfg.ghost.frames && cfg.ghost.frames.length > 10 && cfg.ghost.spec) {
      const gm = createCar(cfg.ghost.spec, cfg.ghost.dress || {}, {});
      gm.setGhost(true); this.scene.add(gm.root);
      this.ghost = { data: cfg.ghost, model: gm };
    }

    // camera rig state
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3(); this.camYaw = this.focus.veh.yaw;
    this.cine = { t: 0, shot: 0 };
    this.snapCamera();
    if (this.hud) this.initHud();
  }

  initHud() {
    const h = this.hud;
    this.tacho = new Tacho(h.tacho, this.cfg.meter);
    this.mini = new MiniMap(h.minimap, this.track);
    h.root.classList.toggle('battle', this.cfg.mode === 'battle');
    h.pos.style.display = this.cfg.mode === 'battle' ? '' : 'none';
    h.lap.style.display = this.laps > 1 ? '' : 'none';
    h.best.textContent = fmt(this.cfg.best?.best);
    this.renderSecs();
  }

  start() {
    this.state = 'countdown'; this.clock = 0; this.countShown = 4;
    Audio.playMusic(this.cfg.settings?.raceBgm || 'race');
  }

  surface(car) {
    const v = car.veh, t = this.track;
    const pr = t.project(v.x, v.z, car.hint, car.surfY); car.hint = pr.i;
    const hw = pr.w / 2;
    const tunnel = t.flags[pr.a].tunnel;
    const wall = hw + (tunnel ? 1.25 : 1.45) - CAR_HALF_W;
    // walls / guardrails
    if (Math.abs(pr.d) > wall) {
      const depth = Math.abs(pr.d) - wall;
      const sgn = Math.sign(pr.d);
      const impact = v.collide(-sgn * pr.nx, -sgn * pr.nz, depth, 0.2, 0.3);
      if (impact > 2 && car === this.focus) { Audio.crash(impact); this.shake = Math.min(1, impact / 12); }
    }
    car.offroad = Math.abs(pr.d) > hw + 0.1 ? 1 : 0;
    v.surfaceGrip = this.world.grip * (car.offroad ? 0.7 : 1);
    if (car.offroad) { v.vx *= 1 - 0.25 * DT; v.vz *= 1 - 0.25 * DT; }
    // height, pitch, roll from the road surface
    const L = v.spec.wheelbase / 2;
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    const yf = t.project(v.x + fx * L, v.z + fz * L, pr.i, car.surfY).y;
    const yr = t.project(v.x - fx * L, v.z - fz * L, pr.i, car.surfY).y;
    car.surfY = pr.y; car.pitch = Math.atan2(yf - yr, L * 2);
    // roll from bank, signed relative to car heading
    const along = fx * t.tx[pr.a] + fz * t.tz[pr.a];
    car.roll = Math.atan(pr.bank) * along;
    v.y = pr.y;
    // gravity along the slope
    const slope = (yf - yr) / (L * 2);
    v.vx -= fx * slope * 9.81 * DT; v.vz -= fz * slope * 9.81 * DT;
    return pr;
  }

  progress(car, pr) {
    const t = this.track;
    if (car.lastS == null) { car.lastS = pr.s; car.prog = t.closed ? pr.s - t.length : pr.s; if (t.closed && pr.s < t.length / 2) car.prog = pr.s; return; }
    let ds = pr.s - car.lastS;
    if (t.closed) { if (ds < -t.length / 2) ds += t.length; if (ds > t.length / 2) ds -= t.length; }
    if (Math.abs(ds) < 30) car.prog += ds;
    car.lastS = pr.s;
    // wrong way detection
    const fwd = Math.sin(car.veh.yaw) * t.tx[pr.a] + Math.cos(car.veh.yaw) * t.tz[pr.a];
    const vdir = (car.veh.vx * t.tx[pr.a] + car.veh.vz * t.tz[pr.a]);
    car.wrong = (fwd < -0.35 && car.veh.speed > 3 && vdir < 0) ? car.wrong + DT : Math.max(0, car.wrong - DT * 2);
  }

  resetCar(car) {
    const s = Math.max(0, car.prog % this.track.length);
    const p = this.track.pointAt(s, 0);
    car.veh.reset(p.x, p.y, p.z, p.yaw); car.veh.gear = 1; car.hint = -1; car.wrong = 0; car.stuck = 0;
    if (car === this.player) this.raceTime += 0; // no penalty, the lost time is the penalty
  }

  carCollisions() {
    const cs = this.cars;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i].veh, b = cs[j].veh;
      const dx = b.x - a.x, dz = b.z - a.z; const d = Math.hypot(dx, dz);
      const R = 2.0;
      if (d > 0.01 && d < R) {
        const nx = dx / d, nz = dz / d, pen = (R - d) / 2;
        a.x -= nx * pen; a.z -= nz * pen; b.x += nx * pen; b.z += nz * pen;
        const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rv < 0) {
          const ma = a.spec.mass, mb = b.spec.mass, j = -(1.3) * rv / (1 / ma + 1 / mb);
          a.vx -= j / ma * nx; a.vz -= j / ma * nz; b.vx += j / mb * nx; b.vz += j / mb * nz;
          a.r += (Math.random() - .5) * 0.3; b.r += (Math.random() - .5) * 0.3;
          if (-rv > 2 && (cs[i] === this.focus || cs[j] === this.focus)) Audio.crash(-rv * 1.5);
        }
      }
    }
  }

  update(dt) {
    if (this.paused) return;
    dt = Math.min(dt, 0.05);
    this.clock += dt;
    const inp = this.player && !this.attract ? Input.drive(dt) : null;
    if (inp?.camera) this.camMode = (this.camMode + 1) % 3;
    if (inp?.reset && this.state === 'race' && this.player) this.resetCar(this.player);

    // countdown
    if (this.state === 'countdown') {
      const left = 3 - Math.floor(this.clock);
      if (left !== this.countShown && left >= 0) {
        this.countShown = left;
        if (left > 0) { this.msg(String(left)); Audio.ui('count'); }
        else { this.msg('GO!!'); Audio.ui('go'); this.state = 'race'; this.raceTime = 0; }
      }
    }
    if (this.attract && this.state === 'intro') { this.state = 'race'; }

    const running = this.state === 'race' || this.state === 'finish';
    this.acc += dt;
    while (this.acc >= DT) {
      this.acc -= DT;
      for (const car of this.cars) {
        let ctl;
        if (car.finished && car.ctrl === 'player') ctl = car.ai ? car.ai.control(car.veh, this.world.grip, DT) : (car.ai = new AIDriver(this.track, 0.8)).control(car.veh, this.world.grip, DT);
        else if (car.ai) ctl = car.ai.control(car.veh, this.world.grip, DT);
        else ctl = inp || { steer: 0, throttle: 0, brake: 0, handbrake: false };
        if (!running) ctl = { steer: ctl.steer, throttle: car.ctrl === 'player' ? ctl.throttle : 0.3 * (Math.sin(this.clock * 3 + this.cars.indexOf(car)) > 0.6 ? 1 : 0), brake: 1, handbrake: true };
        if (car.ctrl === 'player' && !car.finished && inp) {
          if (inp.shiftUp) car.veh.shift(1);
          if (inp.shiftDown) car.veh.shift(-1);
        }
        if (!running) { // revving on the grid
          car.veh.rpm += ((car.veh.spec.engine.idle + ctl.throttle * car.veh.spec.engine.redline * 0.8) - car.veh.rpm) * 0.1;
          car.veh.vx = car.veh.vz = 0; car.veh.r = 0;
          continue;
        }
        car.veh.step(DT, ctl, { driftAssist: car.ai ? 0.9 : this.assist, autoGear: car.ai || car.finished ? true : this.autoGear, stable: car.ai ? 2.5 : 0 });
        const pr = this.surface(car);
        this.progress(car, pr);
        for (const e of car.veh.events) {
          if (car === this.focus) { if (e.type === 'shift') Audio.shiftClunk(); if (e.type === 'bov') Audio.blowOff(e.amt); }
        }
        car.veh.events.length = 0;
      }
      if (running) this.carCollisions();
      if (this.state === 'race') this.raceTime += DT;
    }

    // rules
    if (this.state === 'race' || this.state === 'finish') this.rules(dt);

    // ghost record / playback
    if (this.player && this.state === 'race') {
      this.ghostT += dt;
      if (this.ghostT >= 1 / 20) { this.ghostT = 0; const v = this.player.veh; this.ghostRec.push([+this.raceTime.toFixed(3), +v.x.toFixed(2), +this.player.surfY.toFixed(2), +v.z.toFixed(2), +v.yaw.toFixed(3)]); }
    }
    if (this.ghost) this.poseGhost();

    // visuals
    for (const car of this.cars) {
      car.model.pose(car.veh, { y: car.surfY, pitch: car.pitch, roll: car.roll });
      car.model.setBrake(car.ctrl === 'player' && inp ? Math.max(inp.brake, car.veh.gear < 0 ? 0.5 : 0) : (car.veh.ax < -3 ? 1 : 0));
      const dist = car === this.focus ? 0 : Math.hypot(car.veh.x - this.focus.veh.x, car.veh.z - this.focus.veh.z);
      if (car.engine) car.engine.update(car.veh, car.ctrl === 'player' && inp && running ? Math.max(inp.throttle, car.finished ? 0.3 : 0) : (car.ai ? 0.8 : 0), { dist, gravel: car.offroad });
    }
    this.updateCamera(dt);
    this.world.update(this.camera, dt);
    if (this.hud) this.updateHud();
  }

  rules(dt) {
    const t = this.track;
    for (const car of this.cars) {
      if (car.finished) continue;
      if (car.prog >= this.totalLen - (t.closed ? 0 : 6)) {
        car.finished = true; car.finishTime = this.raceTime;
        if (car === this.player) this.onPlayerFinish();
      }
      if (t.closed) {
        const lap = Math.floor(car.prog / t.length);
        if (lap > car.lap && car === this.player && lap < this.laps) { this.msg('FINAL LAP', 'small'); Audio.ui('section'); }
        car.lap = Math.max(car.lap, lap);
      }
      // stuck / wrong way auto-reset for AI
      if (car.ai && car.wrong > 3) this.resetCar(car);
    }
    if (this.player && !this.player.finished) {
      // sections
      const p = this.player.prog;
      const marks = [];
      for (let L = 0; L < this.laps; L++) for (const s of t.sections) marks.push(L * t.length + s);
      for (let L = 1; L < this.laps; L++) marks.push(L * t.length);
      marks.sort((a, b) => a - b);
      while (this.secIdx < marks.length && p >= marks[this.secIdx]) {
        const time = this.raceTime; const prev = this.sections.length ? this.sections[this.sections.length - 1] : 0;
        this.sections.push(time);
        const bestSec = this.cfg.best?.sections?.[this.sections.length - 1];
        this.showSection(time - prev, bestSec != null ? time - bestSec : null);
        this.secIdx++;
      }
      if (this.hud) this.hud.warn.style.display = this.player.wrong > 1.2 ? 'block' : 'none';
    }
    // battle end: when player finishes or rival is too far ahead
    if (this.cfg.mode === 'battle' && this.player && !this.player.finished && this.state === 'race') {
      const rival = this.cars.find(c => c !== this.player);
      if (rival && rival.finished && this.raceTime - rival.finishTime > 15) { this.player.finished = true; this.player.finishTime = null; this.onPlayerFinish(); }
    }
    if (this.attract) {
      // loop the demo: when the lead car nears the end restart it at the beginning
      for (const car of this.cars) if (car.finished || car.prog > this.totalLen - 30) { this.cfg.onDemoEnd && this.cfg.onDemoEnd(); break; }
    }
  }

  onPlayerFinish() {
    this.state = 'finish'; this.finishClock = this.clock;
    const won = this.cfg.mode === 'battle' ? this.positionOf(this.player) === 1 && this.player.finishTime != null : null;
    this.msg(this.cfg.mode === 'battle' ? (won ? 'WIN!!' : 'LOSE') : 'GOAL!!');
    Audio.ui(won === false ? 'back' : 'start');
    const res = {
      mode: this.cfg.mode, courseId: this.def.id, dir: this.cfg.dir || 'fwd',
      time: this.player.finishTime, sections: this.sections.slice(), won,
      position: this.positionOf(this.player),
      rivalTime: this.cars.find(c => c !== this.player)?.finishTime ?? null,
      ghost: { frames: this.ghostRec, spec: this.player.spec, dress: this.player.dress },
      distance: this.player.prog,
    };
    setTimeout(() => this.cfg.onFinish && this.cfg.onFinish(res), 3200);
  }

  positionOf(car) {
    const sorted = this.cars.slice().sort((a, b) => {
      if (a.finished && b.finished && a.finishTime != null && b.finishTime != null) return a.finishTime - b.finishTime;
      if (a.finished && a.finishTime != null) return -1; if (b.finished && b.finishTime != null) return 1;
      return b.prog - a.prog;
    });
    return sorted.indexOf(car) + 1;
  }

  poseGhost() {
    const f = this.ghost.data.frames; const t = this.state === 'countdown' ? 0 : this.raceTime;
    let lo = 0, hi = f.length - 1;
    if (t >= f[hi][0]) { this.ghost.model.root.visible = false; return; }
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (f[m][0] <= t) lo = m; else hi = m; }
    const a = f[lo], b = f[hi]; const k = (t - a[0]) / Math.max(1e-3, b[0] - a[0]);
    let dy = b[4] - a[4]; if (dy > Math.PI) dy -= 2 * Math.PI; if (dy < -Math.PI) dy += 2 * Math.PI;
    const m = this.ghost.model; m.root.visible = true;
    m.root.position.set(a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k);
    m.root.rotation.set(0, a[4] + dy * k, 0);
    // ghost delta vs player progress
    if (this.player && this.hud && this.state === 'race') {
      const gx = m.root.position.x, gz = m.root.position.z;
      const gp = this.track.project(gx, gz, this._ghint ?? -1, m.root.position.y); this._ghint = gp.i;
    }
  }

  snapCamera() {
    const v = this.focus.veh;
    this.camYaw = v.yaw;
    this.camPos.set(v.x - Math.sin(v.yaw) * 7, v.y + 2.5, v.z - Math.cos(v.yaw) * 7);
    this.camLook.set(v.x, v.y + 1, v.z);
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
  }

  updateCamera(dt) {
    const car = this.focus, v = car.veh;
    if (this.attract) return this.cinematic(dt);
    if (this.state === 'finish' && this.clock - this.finishClock > 1.2) return this.cinematic(dt);
    // follow the direction of travel (shows the drift angle), blended with heading
    const spd = v.speed;
    const velYaw = spd > 3 ? Math.atan2(v.vx, v.vz) : v.yaw;
    let target = v.yaw + angleDiff(velYaw, v.yaw) * 0.55;
    this.camYaw += angleDiff(target, this.camYaw) * Math.min(1, dt * 5.5);
    const modes = [{ d: 6.4, h: 2.1, look: 1.0 }, { d: 9.5, h: 3.4, look: 1.2 }, { d: -0.5, h: 1.15, look: 1.1 }];
    const m = modes[this.camMode];
    const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
    if (this.camMode === 2) {
      // bumper cam (rigid)
      this.camera.position.set(v.x + Math.sin(v.yaw) * 0.6, car.surfY + m.h, v.z + Math.cos(v.yaw) * 0.6);
      this.camLook.set(v.x + Math.sin(v.yaw) * 20, car.surfY + m.h - 0.4 + car.pitch * 20, v.z + Math.cos(v.yaw) * 20);
      this.camera.fov = 72 + Math.min(14, spd * 0.12);
    } else {
      const want = new THREE.Vector3(v.x - sy * m.d, car.surfY + m.h, v.z - cy * m.d);
      this.camPos.lerp(want, Math.min(1, dt * 9));
      this.camPos.y = Math.max(this.camPos.y, car.surfY + 1.0);
      this.camera.position.copy(this.camPos);
      this.camLook.set(v.x + sy * 3, car.surfY + m.look, v.z + cy * 3);
      this.camera.fov = 60 + Math.min(16, spd * 0.16);
    }
    if (this.shake > 0) { this.camera.position.x += (Math.random() - .5) * this.shake * 0.3; this.camera.position.y += (Math.random() - .5) * this.shake * 0.2; this.shake -= dt * 3; }
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.camLook);
  }

  // TV-style cameras for attract mode / replays
  cinematic(dt) {
    const c = this.cine; c.t += dt;
    if (c.t > 6) { c.t = 0; c.shot = (c.shot + 1) % 4; if (this.attract) this.focus = this.cars[c.shot % this.cars.length]; c.anchor = null; }
    const v = this.focus.veh, y = this.focus.surfY;
    const sy = Math.sin(v.yaw), cy = Math.cos(v.yaw);
    let pos, look = new THREE.Vector3(v.x, y + 0.9, v.z);
    if (c.shot === 0) { pos = new THREE.Vector3(v.x - sy * 5 + cy * 2.5, y + 0.6, v.z - cy * 5 - sy * 2.5); }
    else if (c.shot === 1) { // trackside fixed camera ahead of the car
      if (!c.anchor) { const p = this.track.pointAt(this.focus.prog % this.track.length + 70, (Math.random() < .5 ? -1 : 1) * (this.track.w[0] / 2 + 1)); c.anchor = new THREE.Vector3(p.x, p.y + 1.4, p.z); }
      pos = c.anchor.clone();
    } else if (c.shot === 2) { pos = new THREE.Vector3(v.x + sy * 6 + cy * 3, y + 1.0, v.z + cy * 6 - sy * 3); }
    else { const a = c.t * 0.35; pos = new THREE.Vector3(v.x + Math.sin(v.yaw + 2.4 + a) * 8, y + 3.5, v.z + Math.cos(v.yaw + 2.4 + a) * 8); }
    if (c.shot === 1 && c.anchor.distanceTo(look) > 140) c.anchor = null;
    this.camera.position.lerp(pos, c.t < dt * 2 ? 1 : Math.min(1, dt * 6));
    this.camera.fov = c.shot === 1 ? 32 : 55; this.camera.updateProjectionMatrix();
    this.camera.lookAt(look);
  }

  msg(text, cls) {
    if (!this.hud) return;
    const m = this.hud.msg; m.textContent = text; m.style.fontSize = cls === 'small' ? '90px' : '';
    m.classList.remove('show'); void m.offsetWidth; m.classList.add('show');
  }
  showSection(split, delta) {
    if (!this.hud) return;
    Audio.ui('section');
    const el = this.hud.sec;
    el.innerHTML = `SECTION ${this.sections.length} &nbsp; ${fmt(this.raceTime)}` + (delta != null ? ` &nbsp; <span class="delta ${delta < 0 ? 'minus' : 'plus'}">${fmtDelta(delta)}</span>` : '');
    el.style.opacity = 1; clearTimeout(this._secT); this._secT = setTimeout(() => el.style.opacity = 0, 2600);
    this.renderSecs();
  }
  renderSecs() {
    const n = this.track.sections.length * this.laps + (this.laps - 1) + 1;
    let html = '';
    for (let i = 0; i < n; i++) html += `<div class="${this.sections[i] != null ? 'done' : 'pend'}">S${i + 1} ${this.sections[i] != null ? fmt(this.sections[i]) : '--\'--"---'}</div>`;
    this.hud.secs.innerHTML = html;
  }

  updateHud() {
    const h = this.hud, p = this.player; if (!p) return;
    const t = this.state === 'countdown' ? 0 : (p.finished ? p.finishTime ?? this.raceTime : this.raceTime);
    h.time.textContent = fmt(t);
    // live delta vs ghost/best by progress
    if (this.ghost && this.state === 'race') {
      const f = this.ghost.data.frames; const pr = this.player.prog;
      // find ghost time at the player's progress (frames carry positions; precompute progress lazily)
      if (!this.ghost.prog) { this.ghost.prog = []; let hint = -1, last = null, acc = 0; for (const fr of f) { const q = this.track.project(fr[1], fr[3], hint, fr[2]); hint = q.i; if (last != null) { let ds = q.s - last; if (this.track.closed) { if (ds < -this.track.length / 2) ds += this.track.length; if (ds > this.track.length / 2) ds -= this.track.length; } acc += ds; } else acc = q.s; last = q.s; this.ghost.prog.push(acc); } }
      const gp = this.ghost.prog; let i = 0; while (i < gp.length - 1 && gp[i + 1] < pr) i++;
      if (i < gp.length - 1) { const k = (pr - gp[i]) / Math.max(0.01, gp[i + 1] - gp[i]); const gt = f[i][0] + (f[i + 1][0] - f[i][0]) * Math.max(0, Math.min(1, k)); const d = this.raceTime - gt; h.delta.textContent = fmtDelta(d); h.delta.className = 'delta ' + (d < 0 ? 'minus' : 'plus'); }
    } else if (!this.ghost) h.delta.textContent = '';
    if (this.cfg.mode === 'battle') {
      const pos = this.positionOf(p); h.posNum.textContent = pos; h.posSuf.textContent = pos === 1 ? 'st' : 'nd';
      const rival = this.cars.find(c => c !== p);
      if (rival) { const gap = (p.prog - rival.prog); h.gap.textContent = (gap >= 0 ? '+' : '') + gap.toFixed(0) + 'm'; }
    }
    if (this.laps > 1) h.lap.textContent = `LAP ${Math.min(this.laps, Math.floor(Math.max(0, p.prog) / this.track.length) + 1)}/${this.laps}`;
    const v = p.veh;
    this.tacho.draw(v, v.spec, v.kmh, { auto: this.autoGear, warn: p.wrong > 1.2 ? 'WRONG WAY' : (p.offroad ? 'COURSE OUT' : null) });
    const dots = this.cars.map(c => ({ x: c.veh.x, z: c.veh.z, yaw: c.veh.yaw, color: c.color }));
    if (this.ghost && this.ghost.model.root.visible) dots.unshift({ x: this.ghost.model.root.position.x, z: this.ghost.model.root.position.z, yaw: this.ghost.model.root.rotation.y, color: '#36c3ff', alpha: 0.6 });
    this.mini.draw(dots);
    const da = Math.abs(v.driftAngle) * 57.3;
    h.drift.style.opacity = da > 14 && v.speed > 10 ? 1 : 0;
    if (da > 14) h.drift.textContent = `DRIFT ${da.toFixed(0)}°`;
  }

  setPaused(p) { this.paused = p; if (p) for (const c of this.cars) c.engine && c.engine.update(c.veh, 0, { dist: 9999 }); }

  dispose() {
    for (const c of this.cars) { c.engine && c.engine.stop(); c.model.dispose(); }
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
  }
}

function angleDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
