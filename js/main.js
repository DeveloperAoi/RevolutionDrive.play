// REVOLUTION DRIVE — entry point
import { App } from './app.js';
import { Gfx } from './game/gfx.js';
import { Input } from './core/input.js';
import { Audio } from './audio/audio.js';
import { Save } from './core/save.js';
import { UI, fitStage, refreshSync } from './ui/core.js';
import './ui/screens-start.js';
import './ui/screens-menu.js';
import './ui/screens-garage.js';
import './ui/screens-race.js';
import './ui/screens-hub.js';
import { preloadPacks } from './data/glbcars.js';

function boot() {
  fitStage(); addEventListener('resize', fitStage);
  Input.init();
  App.gfx = new Gfx(document.getElementById('gl'));
  App.applySettings();
  preloadPacks();
  Save.on(() => refreshSync());
  // first user gesture unlocks audio (browser autoplay policy)
  const unlock = () => { Audio.unlock(); App.applySettings(); };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    try { App.gfx.frame(dt); } catch (e) { console.error(e); }
    Input.endFrame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__RD = { App, UI, Save, Input, Audio }; // debug handle
  UI.go('init', {}, { wipe: false });
}

try { boot(); } catch (e) {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:0;display:grid;place-items:center;color:#fff;font:20px sans-serif;background:#000">起動に失敗しました: ${e.message}<br>WebGL対応ブラウザでお試しください。</div>`);
}
