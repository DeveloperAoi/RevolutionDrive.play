// Unified input: keyboard, gamepad and touch. Menus receive discrete actions,
// driving reads analog-ish values every frame.
export const Input = {
  keys: new Set(), menuHandler: null, textCapture: null,
  touch: { left: 0, right: 0, acc: 0, brk: 0, hb: 0, steer: null, up: 0, down: 0, cam: 0 },
  tilt: null, tiltOn: false,
  steerKb: 0, edges: new Set(), padPrev: {},
  init() {
    addEventListener('keydown', (e) => {
      if (e.code === 'F9') { e.preventDefault(); import('../app.js').then(m => { m.App.debug = !m.App.debug; }); return; }
      if (this.textCapture && this.textCapture(e)) return;
      // focused buttons/links must not also fire a native click on Enter/Space (double activation)
      if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.target.blur(); }
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') { e.target.blur(); this.menu('back'); }
        if (e.key === 'Enter') this.menu('submit');
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(e.key)) e.preventDefault();
      if (!this.keys.has(e.code)) this.edges.add(e.code);
      this.keys.add(e.code);
      if (e.repeat && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'ok', NumpadEnter: 'ok', Escape: 'back', Backspace: 'back' };
      const a = map[e.key] || ({ KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down' })[e.code];
      if (a) this.menu(a, e);
      if (e.code === 'Space') this.menu('ok', e);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  },
  menu(a, e) { if (this.menuHandler) this.menuHandler(a, e); },
  press(code) { this.edges.add(code); },
  // tilt steering: device roll in landscape → -1..1 (±28° = full lock)
  async enableTilt(on) {
    this.tiltOn = on; if (!on) { this.tilt = null; return true; }
    try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') { this.tiltOn = false; return false; } } } catch { this.tiltOn = false; return false; }
    if (!this._tiltBound) {
      this._tiltBound = true;
      addEventListener('deviceorientation', (e) => {
        if (e.beta == null) return;
        const ang = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 90;
        const roll = ang === 90 ? e.beta : ang === -90 || ang === 270 ? -e.beta : e.gamma;
        this.tilt = Math.abs(roll) < 2 ? 0 : roll / 28;
      });
    }
    return true;
  },
  edge(code) { if (this.edges.has(code)) { this.edges.delete(code); return true; } return false; },
  endFrame() { this.edges.clear(); },
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = [...pads].find(x => x && x.connected); if (!p) return null;
    const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
    const v = (i) => (p.buttons[i] ? p.buttons[i].value : 0);
    const now = { a: b(0), b: b(1), x: b(2), y: b(3), lb: b(4), rb: b(5), start: b(9), up: b(12), down: b(13), left: b(14), right: b(15) };
    const ax = p.axes[0] || 0;
    now.aleft = ax < -0.6; now.aright = ax > 0.6;
    const prev = this.padPrev; this.padPrev = now;
    const pressed = (k) => now[k] && !prev[k];
    if (pressed('left') || pressed('aleft')) this.menu('left');
    if (pressed('right') || pressed('aright')) this.menu('right');
    if (pressed('up')) this.menu('up');
    if (pressed('down')) this.menu('down');
    if (pressed('a') || pressed('start')) this.menu('ok');
    if (pressed('b')) this.menu('back');
    return { steer: Math.abs(ax) > 0.08 ? ax : 0, throttle: v(7), brake: v(6), hb: b(0) || b(2), up: pressed('rb') || pressed('y'), down: pressed('lb') || pressed('x'), cam: pressed('up') && false, pause: pressed('start') };
  },
  drive(dt) {
    const k = this.keys, t = this.touch;
    const pad = this.pollPad();
    const left = k.has('ArrowLeft') || k.has('KeyA') || t.left, right = k.has('ArrowRight') || k.has('KeyD') || t.right;
    const target = (right ? 1 : 0) - (left ? 1 : 0);
    // keyboard steering ramps in, returns faster
    const rate = target === 0 ? 7 : (Math.sign(target) !== Math.sign(this.steerKb) ? 9 : 4.5);
    this.steerKb += Math.max(-rate * dt, Math.min(rate * dt, target - this.steerKb));
    let steer = this.steerKb;
    if (t.steer != null) steer = t.steer; // slide steering (analog)
    if (this.tiltOn && this.tilt != null && !left && !right) steer = Math.max(-1, Math.min(1, this.tilt));
    let throttle = (k.has('ArrowUp') || k.has('KeyW') || t.acc) ? 1 : 0, brake = (k.has('ArrowDown') || k.has('KeyS') || t.brk) ? 1 : 0;
    let hb = k.has('Space') || t.hb;
    let up = this.edge('KeyE') || this.edge('ShiftRight') || this.edge('KeyX') || this.edge('TouchUp');
    let down = this.edge('KeyQ') || this.edge('ControlRight') || this.edge('KeyZ') || this.edge('TouchDown');
    if (pad) {
      if (Math.abs(pad.steer) > Math.abs(steer)) steer = Math.sign(pad.steer) * Math.pow(Math.abs(pad.steer), 1.4);
      throttle = Math.max(throttle, pad.throttle); brake = Math.max(brake, pad.brake); hb = hb || pad.hb; up = up || pad.up; down = down || pad.down;
    }
    return { steer, throttle, brake, handbrake: !!hb, shiftUp: up, shiftDown: down, camera: this.edge('KeyC') || this.edge('TouchCam'), lights: this.edge('KeyH'), reset: this.edge('KeyR'), pause: this.edge('KeyP') || !!(pad && pad.pause) };
  },
};
