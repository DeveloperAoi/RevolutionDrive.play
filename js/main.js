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
import './ui/screens-online.js';
import './ui/screens-story.js';
import './ui/screens-acc.js';
import './ui/screens-dev.js';
import { preloadPacks } from './data/glbcars.js';
import { loadAeroParts, onAeroReady } from './world/aeroParts.js';
import { loadWheelPack, onWheelPackReady } from './world/wheelPack.js';

export async function goFullscreen() {
  try { const el = document.documentElement; if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' }); } catch { /* iOS Safari: not supported */ }
  try { await screen.orientation.lock('landscape'); } catch { /* not supported / not fullscreen */ }
}
window.__goFullscreen = goFullscreen;
function boot() {
  fitStage(); addEventListener('resize', fitStage);
  Input.init();
  App.gfx = new Gfx(document.getElementById('gl'));
  App.applySettings();
  preloadPacks();
  loadAeroParts();
  setTimeout(loadWheelPack, 2500); // 5.8 MB — loaded in the background after start-up
  const redrawCur = () => { try { const c = UI.current; if (c && typeof c.redraw === 'function') c.redraw(); else if (c && c.preview) c.preview(); } catch (e) { /* screen not ready */ } };
  onWheelPackReady(redrawCur);
  onAeroReady(() => { try { const c = UI.current; if (c && typeof c.redraw === 'function') c.redraw(); else if (c && c.id === 'store' && c.preview) c.preview(); } catch (e) { /* screen not ready */ } });
  Save.on(() => refreshSync());
  // first user gesture unlocks audio (browser autoplay policy)
  const unlock = () => { Audio.unlock(); App.applySettings(); };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  // tappable key guide (touch screens): ◀ ▶ ▲ ▼ / START / VIEW pills send menu actions
  addEventListener('pointerup', (e) => { const t = e.target.closest && e.target.closest('[data-act]'); if (t && t.dataset.act && !t.closest('.touch')) { e.preventDefault(); Input.menu(t.dataset.act); } });
  // portrait phones: ask to rotate; fullscreen + landscape lock on first tap when installed/allowed
  const orient = () => document.body.classList.toggle('portrait', App.isTouch && innerHeight > innerWidth * 1.05);
  addEventListener('resize', orient); orient();
  if (App.isTouch) document.body.classList.add('is-touch');
  const rot = document.createElement('div'); rot.id = 'rotate'; rot.innerHTML = '<div class="ph"></div><b>端末を横向きにしてください</b><small>REVOLUTION DRIVE は横画面でプレイします</small><button>全画面で遊ぶ</button>';
  rot.querySelector('button').onclick = () => goFullscreen(); document.body.appendChild(rot);
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
