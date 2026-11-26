// Shared application context
import { Save } from './core/save.js';
import { Audio } from './audio/audio.js';
import { carById, buildSpec } from './data/cars.js';

export const VERSION = 'Ver.1.30.00';
export const SITE_URL = 'https://github.com/DeveloperAoi/RevolutionDrive.play';

export const App = {
  gfx: null, showroom: null, titleScene: null, race: null,
  isTouch: matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
  // global settings used before a profile is loaded
  get settings() { return Save.profile ? Save.profile.settings : (this._s ||= { bgm: 6, sfx: 8, autoGear: true, assist: 6, camera: 0, touch: 'auto' }); },
  applySettings() { const s = this.settings; Audio.setVolume('bgm', s.bgm); Audio.setVolume('sfx', s.sfx); Audio.setVolume('guide', s.guideSe ?? 7); if (this.gfx && this.gfx.setQuality && this._gq !== s.gfx) { this._gq = s.gfx; this.gfx.setQuality(s.gfx || 'high'); } },
  specOf(gc) { return buildSpec(carById(gc.carId), gc.tune, gc.setup, gc.dress); },
  // race session request built by the select screens
  pending: { mode: 'trial', courseId: 'akane', dir: 'fwd', weather: null },
};
