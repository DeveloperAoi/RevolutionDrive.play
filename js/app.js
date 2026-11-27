// Shared application context
import { Save } from './core/save.js';
import { Audio } from './audio/audio.js';
import { carById, buildSpec } from './data/cars.js';
import { Input } from './core/input.js';

export const VERSION = 'Ver.2.06.01';
export const SITE_URL = 'https://github.com/DeveloperAoi/RevolutionDrive.play';

export const App = {
  debug: /[?&]debug\b/.test(location.search),
  gfx: null, showroom: null, titleScene: null, race: null,
  isTouch: matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
  // global settings used before a profile is loaded
  get settings() { return Save.profile ? Save.profile.settings : (this._s ||= { bgm: 6, sfx: 8, autoGear: true, assist: 6, camera: 0, touch: 'auto' }); },
  applySettings() { const s = this.settings; Audio.setVolume('bgm', s.bgm); Audio.setVolume('sfx', s.sfx); Audio.setVolume('guide', s.guideSe ?? 7); const q = s.gfx || (this.isTouch ? 'low' : 'high'); if (this.gfx && this.gfx.setQuality && this._gq !== q) { this._gq = q; this.gfx.setQuality(q); } Input && Input.enableTilt && Input.enableTilt(this.isTouch && s.touchSteer === 'tilt'); },
  specOf(gc) { return buildSpec(carById(gc.carId), gc.tune, gc.setup, gc.dress); },
  // race session request built by the select screens
  // hub screen to return to after a sub screen (shop -> tuning -> back to shop)
  hubReturn: null,
  takeReturn(def) { const t = this.hubReturn; this.hubReturn = null; return t || def; },
  pending: { mode: 'trial', courseId: 'akane', dir: 'fwd', weather: null },
};
