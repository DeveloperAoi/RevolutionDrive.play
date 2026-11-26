// REVOLUTION DRIVE — online battle (1 vs 1)
// Matchmaking & signalling: Cloud Firestore (rooms/{id}). Race traffic: WebRTC data channels
// (peer-to-peer, low latency). If a direct connection cannot be made (strict NAT/firewall),
// the session falls back to relaying through Firestore at a lower rate.
// Guests are signed in with Firebase Anonymous Auth so security rules can identify them.
import * as Net from './firebase.js';

const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
const PROTO = 2;
const now = () => performance.now();
const rnd = (n, chars = '0123456789') => Array.from(crypto.getRandomValues(new Uint32Array(n)), v => chars[v % chars.length]).join('');

export async function ensureAuth() {
  if (!Net.isConfigured()) throw Object.assign(new Error('server not configured'), { code: 'rd/no-server' });
  const fb = await Net.init();
  if (!Net.currentUser) {
    try { await fb.A.signInAnonymously(fb.auth); }
    catch (e) { if (e.code === 'auth/operation-not-allowed' || e.code === 'auth/admin-restricted-operation') throw Object.assign(new Error('anonymous disabled'), { code: 'rd/anon-off' }); throw e; }
  }
  return Net.currentUser;
}

export const ONLINE_ERR = {
  'rd/no-server': 'ゲームサーバーが設定されていません。',
  'rd/anon-off': 'ゲストでのオンライン対戦が無効になっています。アカウントでログインするか、管理者が Firebase の「匿名ログイン」を有効にしてください。',
  'rd/no-room': 'ルームが見つかりません。コードを確認してください。',
  'rd/room-full': 'このルームはすでに対戦相手が決まっています。',
  'rd/own-room': '自分が作成したルームには参加できません。',
  'rd/timeout': '接続がタイムアウトしました。',
  'permission-denied': 'サーバーに拒否されました。Firestore のセキュリティルール(オンライン対戦用)が更新されているか確認してください。',
};
export const onlineErr = (e) => ONLINE_ERR[e?.code] || Net.errText(e);

export class OnlineSession {
  constructor(me) {
    this.me = me;            // { name, team, rp, icon, carId, carName, tune, setup, dress }
    this.role = null;        // 'host' | 'guest'
    this.id = null; this.room = null; this.peer = null;
    this.handlers = {}; this.unsubs = [];
    this.pc = null; this.dcFast = null; this.dcRel = null;
    this.transport = 'none'; // 'p2p' | 'relay'
    this.offset = 0;         // remote clock - local clock (ms), guest side
    this.rtt = 0;
    this.buf = [];           // remote race states [{t, ...}]
    this.remoteFinish = null; this.closed = false; this.lastSend = 0; this.relayQ = []; this.relaySeq = 0; this.relaySeen = 0; this.lastRx = now();
  }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); return this; }
  emit(ev, ...a) { (this.handlers[ev] || []).forEach(fn => { try { fn(...a); } catch (e) { console.error(e); } }); }
  get F() { return Net.sdk().F; } get db() { return Net.sdk().db; } get uid() { return Net.currentUser.uid; }
  roomRef(id = this.id) { return this.F.doc(this.db, 'rooms', id); }

  // ---------- room lifecycle ----------
  async createRoom({ pub, course }) {
    await ensureAuth(); const F = this.F;
    for (let tries = 0; tries < 5; tries++) {
      const id = pub ? 'W' + rnd(9, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') : rnd(6);
      try {
        await F.runTransaction(this.db, async (tx) => {
          const ref = this.roomRef(id); const s = await tx.get(ref);
          if (s.exists() && s.data().ts > Date.now() - 10 * 60e3) throw Object.assign(new Error('taken'), { code: 'rd/taken' });
          tx.set(ref, { v: PROTO, host: this.uid, guest: null, status: 'open', pub: !!pub, ts: Date.now(), course, hostInfo: this.me, guestInfo: null, rank: this.me.rankClass || 0 });
        });
        this.id = id; this.role = 'host'; this.watchRoom(); return id;
      } catch (e) { if (e.code !== 'rd/taken') throw e; }
    }
    throw new Error('could not allocate a room');
  }
  async joinRoom(id) {
    await ensureAuth(); const F = this.F;
    await F.runTransaction(this.db, async (tx) => {
      const ref = this.roomRef(id); const s = await tx.get(ref);
      if (!s.exists() || s.data().status === 'closed' || s.data().ts < Date.now() - 30 * 60e3) throw Object.assign(new Error('no room'), { code: 'rd/no-room' });
      const d = s.data();
      if (d.host === this.uid) throw Object.assign(new Error('own'), { code: 'rd/own-room' });
      if (d.guest && d.guest !== this.uid) throw Object.assign(new Error('full'), { code: 'rd/room-full' });
      tx.update(ref, { guest: this.uid, guestInfo: this.me, status: 'matched' });
    });
    this.id = id; this.role = 'guest'; this.watchRoom();
  }
  // WORLDWIDE MATCH: join a waiting public room (closest rank first) or open one and wait
  async findMatch(course, onStatus = () => {}) {
    await ensureAuth(); const F = this.F;
    onStatus('search');
    const q = F.query(F.collection(this.db, 'rooms'), F.where('pub', '==', true), F.where('status', '==', 'open'), F.limit(20));
    const snap = await F.getDocs(q);
    const mine = this.me.rankClass || 0;
    const cands = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.host !== this.uid && r.ts > Date.now() - 90e3 && r.v === PROTO)
      .sort((a, b) => Math.abs((a.rank || 0) - mine) - Math.abs((b.rank || 0) - mine) || a.ts - b.ts);
    for (const r of cands) { try { await this.joinRoom(r.id); onStatus('found'); return; } catch { /* taken meanwhile */ } }
    onStatus('wait');
    await this.createRoom({ pub: true, course });
    // refresh the timestamp while waiting so the room stays discoverable
    this.keepAlive = setInterval(() => { if (this.room?.status === 'open') this.F.updateDoc(this.roomRef(), { ts: Date.now() }).catch(() => {}); }, 30e3);
  }
  watchRoom() {
    const un = this.F.onSnapshot(this.roomRef(), (s) => {
      if (!s.exists()) { this.room = null; if (!this.closed) this.emit('closed', 'room-deleted'); return; }
      const prev = this.room; this.room = s.data();
      if (this.role === 'host' && this.room.guest && (!prev || !prev.guest)) { this.peer = this.room.guestInfo; this.emit('matched', this.peer); this.connect(); }
      if (this.role === 'guest' && !prev) { this.peer = this.room.hostInfo; this.emit('matched', this.peer); this.connect(); }
      if (this.role === 'guest' && this.room.guest !== this.uid && !this.closed) this.emit('closed', 'kicked');
      if (this.room.status === 'closed' && !this.closed) this.emit('closed', 'peer-left');
      this.emit('room', this.room);
    }, (e) => this.emit('error', e));
    this.unsubs.push(un);
  }
  async setCourse(course) { if (this.role === 'host') await this.F.updateDoc(this.roomRef(), { course }); }

  // ---------- WebRTC ----------
  async connect() {
    if (this.pc) return;
    clearInterval(this.keepAlive);
    const pc = this.pc = new RTCPeerConnection({ iceServers: STUN });
    const F = this.F, me = this.role, other = me === 'host' ? 'guest' : 'host';
    const sigRef = (r) => F.doc(this.db, 'rooms', this.id, 'signal', r);
    const gather = () => new Promise(res => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 3500); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });
    const bind = (dc) => { dc.onopen = () => this.onOpen(); dc.onmessage = (e) => this.onData(e.data); dc.onclose = () => { if (!this.closed && this.transport === 'p2p') this.emit('closed', 'peer-left'); }; };
    if (me === 'host') {
      this.dcRel = pc.createDataChannel('rel', { ordered: true }); bind(this.dcRel);
      this.dcFast = pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 }); this.dcFast.onmessage = (e) => this.onData(e.data);
      await pc.setLocalDescription(await pc.createOffer()); await gather();
      await F.setDoc(sigRef('host'), { sdp: JSON.stringify(pc.localDescription), ts: Date.now() });
    } else {
      pc.ondatachannel = (e) => { if (e.channel.label === 'rel') { this.dcRel = e.channel; bind(e.channel); } else { this.dcFast = e.channel; e.channel.onmessage = (ev) => this.onData(ev.data); } };
    }
    const un = F.onSnapshot(sigRef(other), async (s) => {
      if (!s.exists() || this.closed) return;
      const d = JSON.parse(s.data().sdp);
      try {
        if (me === 'guest' && !pc.remoteDescription) {
          await pc.setRemoteDescription(d); await pc.setLocalDescription(await pc.createAnswer()); await gather();
          await F.setDoc(sigRef('guest'), { sdp: JSON.stringify(pc.localDescription), ts: Date.now() });
        } else if (me === 'host' && !pc.remoteDescription) await pc.setRemoteDescription(d);
      } catch (e) { console.warn('[online] signal', e); }
    });
    this.unsubs.push(un);
    // no direct path within 12 s → relay through Firestore
    this.relayTimer = setTimeout(() => { if (this.transport === 'none' && !this.closed) this.startRelay(); }, 12000);
  }
  onOpen() {
    if (this.transport === 'p2p') return;
    clearTimeout(this.relayTimer);
    this.transport = 'p2p'; this.emit('connected', 'p2p');
    if (this.role === 'guest') this.syncClock();
  }
  // ---------- Firestore relay fallback ----------
  startRelay() {
    this.transport = 'relay'; const F = this.F, other = this.role === 'host' ? 'guest' : 'host';
    const ref = (r) => F.doc(this.db, 'rooms', this.id, 'relay', r);
    this.unsubs.push(F.onSnapshot(ref(other), (s) => {
      if (!s.exists()) return; const d = s.data();
      for (const m of d.rel || []) if (m.i > this.relaySeen) { this.relaySeen = m.i; this.onData(m.d); }
      if (d.st) this.onData(d.st);
    }));
    let busy = false;
    this.relayFlush = setInterval(async () => {
      if (busy || this.closed || (!this.relayQ.length && !this.relaySt)) return; busy = true;
      try { await F.setDoc(ref(this.role), { rel: this.relayQ.slice(-12), st: this.relaySt || null, ts: Date.now() }); this.relaySt = null; } catch (e) { console.warn('[online] relay', e); }
      busy = false;
    }, 400);
    this.emit('connected', 'relay');
    if (this.role === 'guest') this.syncClock();
  }

  // ---------- messaging ----------
  send(type, data = {}, fast = false) {
    const msg = JSON.stringify({ k: type, ...data });
    if (this.transport === 'p2p') { const dc = fast && this.dcFast?.readyState === 'open' ? this.dcFast : this.dcRel; if (dc?.readyState === 'open') dc.send(msg); }
    else if (this.transport === 'relay') { if (fast) this.relaySt = msg; else this.relayQ.push({ i: ++this.relaySeq, d: msg }); }
  }
  onData(raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    this.lastRx = now();
    switch (m.k) {
      case 'ping': return this.send('pong', { a: m.a, h: Date.now() });
      case 'pong': return this._pong && this._pong(m);
      case 'st': this.buf.push(m); if (this.buf.length > 90) this.buf.splice(0, this.buf.length - 90); if (m.ft != null) this.remoteFinish = m.ft; return;
      case 'fin': this.remoteFinish = m.t; return this.emit('finish', m.t);
      case 'ready': this.peerReady = true; return this.emit('ready', m);
      case 'synced': this.peerSynced = true; return this.emit('synced', m.rtt);
      case 'bye': if (!this.closed) this.emit('closed', 'peer-left'); return;
      default: return this.emit(m.k, m);
    }
  }
  // guest estimates the host clock offset from a few ping/pongs (lowest RTT wins)
  async syncClock() {
    let best = 1e9;
    for (let k = 0; k < 6 && !this.closed; k++) {
      const r = await new Promise(res => { const a = Date.now(); this._pong = (m) => { if (m.a === a) res(m); }; this.send('ping', { a }); setTimeout(() => res(null), 1500); });
      if (r) { const t1 = Date.now(), rtt = t1 - r.a; if (rtt < best) { best = rtt; this.offset = r.h - (r.a + t1) / 2; this.rtt = rtt; } }
      await new Promise(res => setTimeout(res, 120));
    }
    this.send('synced', { rtt: this.rtt });
    this.emit('synced', this.rtt);
  }
  hostTime() { return this.role === 'host' ? Date.now() : Date.now() + this.offset; }
  // host schedules the start; both sides fire the callback at the same wall-clock moment
  scheduleStart(cb, lead = 3500) {
    if (this.role === 'host') {
      const go = () => { const at = Date.now() + lead + (this.transport === 'relay' ? 2500 : 0); this.send('go', { at }); setTimeout(cb, at - Date.now()); };
      if (this.peerReady) go(); else { let done = false; this.on('ready', () => { if (!done) { done = true; go(); } }); }
    }
    else { const fire = (m) => setTimeout(cb, Math.max(0, m.at - this.hostTime())); this.on('go', fire); }
  }

  // ---------- race state ----------
  tick(race) {
    const p = race.player; if (!p) return;
    const t = now(), iv = this.transport === 'relay' ? 400 : 50;
    if (t - this.lastSend < iv) return; this.lastSend = t;
    const v = p.veh;
    this.send('st', { t: +race.raceTime.toFixed(3), x: +v.x.toFixed(2), z: +v.z.toFixed(2), y: +p.surfY.toFixed(2), yaw: +v.yaw.toFixed(3), vx: +v.vx.toFixed(2), vz: +v.vz.toFixed(2), st: +(v.steer || 0).toFixed(2), rpm: Math.round(v.rpm), g: v.gear, p: +p.prog.toFixed(1), b: race.lastInput?.brake > 0.2 ? 1 : 0, ft: p.finished ? p.finishTime : null }, true);
  }
  sendFinish(t) { this.send('fin', { t }); }
  // remote state at race time t (rendered ~100 ms behind for smooth interpolation)
  remoteAt(t) {
    const B = this.buf; if (!B.length) return null;
    const rt = t - (this.transport === 'relay' ? 0.5 : 0.1);
    let i = B.length - 1; while (i > 0 && B[i - 1].t > rt) i--;
    const b = B[i], a = B[i - 1];
    if (a && a.t <= rt && b.t >= rt) {
      const f = (rt - a.t) / Math.max(1e-3, b.t - a.t), L = (x, y) => x + (y - x) * f;
      let dy = b.yaw - a.yaw; if (dy > Math.PI) dy -= Math.PI * 2; if (dy < -Math.PI) dy += Math.PI * 2;
      return { ...b, x: L(a.x, b.x), z: L(a.z, b.z), y: L(a.y, b.y), yaw: a.yaw + dy * f, p: L(a.p, b.p), st: L(a.st, b.st), rpm: L(a.rpm, b.rpm) };
    }
    const last = B[B.length - 1]; const ex = Math.max(0, Math.min(0.6, rt - last.t)); // short extrapolation
    return { ...last, x: last.x + last.vx * ex, z: last.z + last.vz * ex, p: last.p + Math.hypot(last.vx, last.vz) * ex };
  }
  get silent() { return now() - this.lastRx; }

  async leave(reason = 'leave') {
    if (this.closed) return; this.closed = true;
    try { this.send('bye'); } catch { /* ignore */ }
    clearTimeout(this.relayTimer); clearInterval(this.relayFlush); clearInterval(this.keepAlive);
    this.unsubs.forEach(u => { try { u(); } catch { /* ignore */ } }); this.unsubs = [];
    try { this.pc && this.pc.close(); } catch { /* ignore */ }
    if (this.id && Net.sdk()) {
      const F = this.F;
      try {
        if (this.role === 'host') {
          for (const sub of ['signal', 'relay']) for (const r of ['host', 'guest']) await F.deleteDoc(F.doc(this.db, 'rooms', this.id, sub, r)).catch(() => {});
          await F.deleteDoc(this.roomRef());
        } else await F.updateDoc(this.roomRef(), { status: 'closed' }).catch(() => {});
      } catch { /* ignore */ }
    }
  }
}
