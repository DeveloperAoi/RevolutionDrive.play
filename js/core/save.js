// REVOLUTION DRIVE — player data, IndexedDB persistence, autosave and cloud sync
// GUEST:   profiles live in IndexedDB under owner "guest".
// ACCOUNT: profiles live in Firestore (users/{uid}/profiles/{slot}) and are cached in
//          IndexedDB under owner "uid:<uid>". Failed uploads stay queued locally and retry.
import * as Net from '../net/firebase.js';
import { CARS, carById, MAX_GARAGE } from '../data/cars.js';
import { COURSES } from '../data/courses.js';
import { normalizeCar, defaultDressV2, defaultMeter, partPrice } from '../data/custom.js';
const partFree = (cat, id) => partPrice(cat, id) === 0;

const DB_NAME = 'revolution-drive';
const DB_VER = 1;
let dbp = null;

function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, DB_VER);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('ghosts')) db.createObjectStore('ghosts', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'k' });
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode); const s = t.objectStore(store);
    let out; const r = fn(s); if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
}
export const idb = {
  get: (store, key) => tx(store, 'readonly', s => s.get(key)),
  put: (store, val) => tx(store, 'readwrite', s => s.put(val)),
  del: (store, key) => tx(store, 'readwrite', s => s.delete(key)),
  all: (store) => tx(store, 'readonly', s => s.getAll()),
};
export async function idbAvailable() { try { await openDB(); return true; } catch { return false; } }

// ---- rank system ----------------------------------------------------------
// Rank points (RP) are earned from races. Classes: G (rookie) → F → E → D → C → B → A → S → SS
export const RANK_CLASSES = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS'];
export function rankOf(rp) {
  const per = 300; // RP per level, 5 levels per class
  const lv = Math.floor(rp / per);
  const ci = Math.min(RANK_CLASSES.length - 1, Math.floor(lv / 5));
  const level = ci === RANK_CLASSES.length - 1 ? Math.min(9, lv - ci * 5 + 1) : (lv % 5) + 1;
  return { cls: RANK_CLASSES[ci], level, label: RANK_CLASSES[ci] + level, progress: (rp % per) / per, ci };
}
export const RANK_COLORS = ['#9aa0a8', '#7dff5a', '#3dd17a', '#36c3ff', '#1e8cff', '#b06aff', '#ff7a00', '#ffd400', '#ff2a3a'];

const newId = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)).toUpperCase();

export function newProfile(owner) {
  const now = Date.now();
  return {
    id: 'P' + newId(), owner, version: 1, createdAt: now, updatedAt: now, lastPlayed: now,
    driverName: '', teamName: '', icon: 0,
    credits: 5000, xp: 0, rp: 0, tp: 30, inventory: {},
    cars: [], activeCar: null,
    unlocked: { courses: COURSES.filter(c => !c.unlock).map(c => c.id) },
    records: {}, stats: { races: 0, wins: 0, trials: 0, km: 0, battles: 0 },
    settings: { bgm: 6, sfx: 8, autoGear: true, assist: 6, camera: 0, touch: 'auto', custTimer: true, raceBgm: 'race' },
    flags: {},
  };
}

export function makeGarageCar(carId) {
  const c = carById(carId);
  return {
    uid: 'C' + newId(), carId: c.id, name: c.name, maker: c.maker, drive: c.drive, hp: c.engine.hp, disp: c.disp,
    tune: { v2: true }, dress: defaultDressV2(), meter: defaultMeter(), setup: {}, registeredAt: Date.now(), races: 0, km: 0, active: false,
  };
}

// ---- save manager -----------------------------------------------------------
class SaveManager {
  constructor() {
    this.mode = 'guest'; // 'guest' | 'account'
    this.owner = 'guest';
    this.profile = null;
    this.status = 'local'; // local | saving | synced | pending | error
    this.lastSave = 0;
    this.pending = false;
    this.listeners = new Set();
    this._timer = null; this._retry = null; this._retryDelay = 4000;
    window.addEventListener('online', () => this.flushCloud());
    window.addEventListener('beforeunload', () => { if (this._timer) this.persistNow(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this._timer) this.persistNow(); });
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach(f => f(this)); }
  key(p = this.profile) { return `${p.owner}/${p.id}`; }

  setGuest() { this.mode = 'guest'; this.owner = 'guest'; this.status = 'local'; this.emit(); }
  setAccount(uid) { this.mode = 'account'; this.owner = 'uid:' + uid; this.uid = uid; this.status = 'synced'; this.emit(); }

  async localProfiles(owner = this.owner) {
    const all = await idb.all('profiles');
    return all.filter(r => r.owner === owner).map(r => r.data).sort((a, b) => b.lastPlayed - a.lastPlayed);
  }

  // Returns all profiles for the active owner. For accounts the cloud is merged with
  // the local cache, newest updatedAt wins, and unsynced local changes are uploaded.
  async listProfiles() {
    const local = await this.localProfiles();
    if (this.mode !== 'account') return local;
    let cloud = [];
    try { cloud = await Net.listCloudProfiles(this.uid); this.status = 'synced'; }
    catch (e) { console.warn(e); this.status = 'error'; this.emit(); return local; }
    const map = new Map();
    for (const p of cloud) map.set(p.id, p);
    for (const p of local) {
      const c = map.get(p.id);
      if (!c || (p.updatedAt || 0) > (c.updatedAt || 0)) { map.set(p.id, p); if (p._dirty) this._queueUpload(p); }
    }
    const out = [...map.values()];
    for (const p of out) await idb.put('profiles', { key: `${this.owner}/${p.id}`, owner: this.owner, data: p });
    this.emit();
    return out.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
  }

  async use(profile) {
    this.profile = profile; profile.owner = this.owner; profile.lastPlayed = Date.now();
    this.migrate(profile);
    await this.persistNow('load');
  }
  create() { this.profile = newProfile(this.owner); return this.profile; }
  // bring older save data up to the current structure without losing anything
  migrate(p) {
    p.tp ??= 30; p.settings ??= {}; p.inventory ??= {};
    p.unlocked ??= { courses: [] }; for (const c of COURSES) if (!c.unlock && !p.unlocked.courses.includes(c.id)) p.unlocked.courses.push(c.id);
    // grant everything already equipped / bought before the IN-STORE existed
    for (const c of p.cars) {
      normalizeCar(c);
      for (const [k, v] of Object.entries(c.dress.aero || {})) if (v) p.inventory[`${k}:${v}`] = true;
      if (c.dress.muffler !== 'stock') p.inventory[`muffler:${c.dress.muffler}`] = true;
      for (const w of [c.dress.wheel.f, c.dress.wheel.r]) if (w.design !== 'stock5') p.inventory[`wheel:${w.design}`] = true;
      for (const [slot, v] of Object.entries(c.dress.vinyl || {})) if (v.d !== 'none') p.inventory[`vinyl:${v.d}`] = true;
    } p.settings.custTimer ??= true; p.settings.raceBgm ??= 'race'; p.flags ??= {};
    for (const c of p.cars) { normalizeCar(c); c.active = c.uid === p.activeCar; }
  }

  // mark changed and autosave shortly after (debounced)
  touch(reason = 'auto') {
    if (!this.profile) return;
    this.profile.updatedAt = Date.now();
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.persistNow(reason), 600);
    this.status = 'saving'; this.emit();
  }

  async persistNow(reason = 'save') {
    clearTimeout(this._timer); this._timer = null;
    const p = this.profile; if (!p) return;
    p.updatedAt = Date.now();
    if (this.mode === 'account') p._dirty = true;
    try { await idb.put('profiles', { key: this.key(p), owner: p.owner, data: p }); }
    catch (e) { console.error('local save failed', e); this.status = 'error'; this.emit(); return; }
    this.lastSave = Date.now();
    if (this.mode === 'account') await this._upload(p);
    else { this.status = 'local'; this.emit(); }
  }

  async _upload(p) {
    if (!navigator.onLine) { this.status = 'pending'; this.pending = true; this.emit(); this._scheduleRetry(); return; }
    try {
      const copy = { ...p }; delete copy._dirty;
      await Net.saveCloudProfile(this.uid, copy);
      p._dirty = false;
      await idb.put('profiles', { key: this.key(p), owner: p.owner, data: p });
      this.status = 'synced'; this.pending = false; this._retryDelay = 4000;
    } catch (e) {
      console.warn('cloud sync failed — kept locally', e);
      this.status = 'pending'; this.pending = true; this._scheduleRetry();
    }
    this.emit();
  }
  _queueUpload(p) { if (this.profile && p.id === this.profile.id) return; this._upload(p); }
  _scheduleRetry() {
    clearTimeout(this._retry);
    this._retry = setTimeout(() => this.flushCloud(), this._retryDelay);
    this._retryDelay = Math.min(60000, this._retryDelay * 2);
  }
  async flushCloud() {
    if (this.mode !== 'account' || !this.profile) return;
    if (this.profile._dirty || this.pending) await this._upload(this.profile);
  }

  async deleteProfile(p) {
    await idb.del('profiles', `${p.owner}/${p.id}`);
    if (this.mode === 'account') { try { await Net.deleteCloudProfile(this.uid, p.id); } catch (e) { console.warn(e); } }
  }

  // Copy a guest profile into the signed-in account. The guest copy is kept (marked).
  async migrateGuest(guestProfile) {
    if (this.mode !== 'account') throw new Error('not signed in');
    if (guestProfile.migratedTo === this.uid) return { already: true };
    const existing = await this.listProfiles();
    if (existing.some(p => p.migratedFrom === guestProfile.id)) return { already: true };
    const copy = JSON.parse(JSON.stringify(guestProfile));
    copy.id = 'P' + newId(); copy.owner = this.owner; copy.migratedFrom = guestProfile.id; copy.updatedAt = Date.now();
    await idb.put('profiles', { key: `${this.owner}/${copy.id}`, owner: this.owner, data: copy });
    await this._upload(copy);
    guestProfile.migratedTo = this.uid;
    await idb.put('profiles', { key: `guest/${guestProfile.id}`, owner: 'guest', data: guestProfile });
    return { profile: copy };
  }

  // ---- ghosts (local only for now) ----
  ghostKey(course, dir) { return `${this.owner}/${this.profile.id}/${course}/${dir}`; }
  async saveGhost(course, dir, data) { if (this.profile) await idb.put('ghosts', { key: this.ghostKey(course, dir), data }); }
  async loadGhost(course, dir) { if (!this.profile) return null; const r = await idb.get('ghosts', this.ghostKey(course, dir)); return r ? r.data : null; }

  // ---- garage helpers ----
  get activeCar() { const p = this.profile; return p ? (p.cars.find(c => c.uid === p.activeCar) || p.cars[0] || null) : null; }
  owns(cat, id) { return !this.profile || partFree(cat, id) || !!this.profile.inventory?.[`${cat}:${id}`]; }
  canAddCar() { return this.profile.cars.length < MAX_GARAGE; }
  addCar(carId) {
    if (!this.canAddCar()) return null;
    const gc = makeGarageCar(carId); this.profile.cars.push(gc);
    if (!this.profile.activeCar) this.profile.activeCar = gc.uid;
    this.touch('car-add'); return gc;
  }
  removeCar(uid) {
    const p = this.profile; if (p.cars.length <= 1) return false;
    p.cars = p.cars.filter(c => c.uid !== uid);
    if (p.activeCar === uid) p.activeCar = p.cars[0].uid;
    this.touch('car-remove'); return true;
  }
  setActive(uid) { this.profile.activeCar = uid; this.profile.cars.forEach(c => c.active = c.uid === uid); this.touch('car-change'); }
}

export const Save = new SaveManager();
export { MAX_GARAGE, CARS };
