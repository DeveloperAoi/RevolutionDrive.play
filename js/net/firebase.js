// Firebase wrapper: Authentication (email/password) + Firestore cloud saves.
// The SDK is loaded lazily from Google's CDN only when a config is present.
// Auth sessions are persisted in IndexedDB (not localStorage). Passwords are never stored
// by the game — they go straight to Firebase Authentication over HTTPS.
import { firebaseConfig, FIREBASE_SDK_VERSION as V } from './firebase-config.js';

let fb = null; // { app, auth, db, A (auth module), F (firestore module) }
let initPromise = null;
const listeners = new Set();
export let currentUser = null;

export const isConfigured = () => !!(firebaseConfig && firebaseConfig.apiKey);

export function init() {
  if (!isConfigured()) return Promise.resolve(null);
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const base = `https://www.gstatic.com/firebasejs/${V}/`;
    const [appM, A, F] = await Promise.all([
      import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js'),
    ]);
    const app = appM.initializeApp(firebaseConfig);
    const auth = A.initializeAuth(app, { persistence: [A.indexedDBLocalPersistence, A.inMemoryPersistence] });
    auth.languageCode = 'ja';
    const db = F.getFirestore(app);
    fb = { app, auth, db, A, F, appM };
    await new Promise(res => {
      let first = true;
      A.onAuthStateChanged(auth, (u) => {
        currentUser = u;
        listeners.forEach(fn => fn(u));
        if (first) { first = false; res(); }
      });
    });
    return fb;
  })().catch(e => { console.warn('Firebase init failed', e); initPromise = null; throw e; });
  return initPromise;
}

export function onAuth(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const sdk = () => fb;

const JP_ERR = {
  'auth/email-already-in-use': 'このメールアドレスは既に登録されています。',
  'auth/invalid-email': 'メールアドレスの形式が正しくありません。',
  'auth/weak-password': 'パスワードは6文字以上にしてください。',
  'auth/user-not-found': 'アカウントが見つかりません。',
  'auth/wrong-password': 'パスワードが違います。',
  'auth/invalid-credential': 'メールアドレスまたはパスワードが違います。',
  'auth/too-many-requests': '試行回数が多すぎます。しばらく待ってから再度お試しください。',
  'auth/network-request-failed': 'ネットワークに接続できません。',
  'auth/requires-recent-login': '安全のため、もう一度パスワードを入力してください。',
  'auth/missing-password': 'パスワードを入力してください。',
  'permission-denied': 'アクセスが拒否されました(セキュリティルールを確認してください)。',
  'unavailable': 'サーバーに接続できません。オフラインの可能性があります。',
};
export const errText = (e) => JP_ERR[e?.code] || (e?.message || 'エラーが発生しました。');

export async function register(email, password) {
  await init(); const { A, auth } = fb;
  const cred = await A.createUserWithEmailAndPassword(auth, email, password);
  try { await A.sendEmailVerification(cred.user); } catch { /* optional */ }
  await fb.F.setDoc(fb.F.doc(fb.db, 'users', cred.user.uid), { createdAt: fb.F.serverTimestamp(), app: 'revolution-drive' }, { merge: true });
  return cred.user;
}
export async function login(email, password) { await init(); return (await fb.A.signInWithEmailAndPassword(fb.auth, email, password)).user; }
export async function logout() { if (!fb) return; await fb.A.signOut(fb.auth); }
export async function resetPassword(email) { await init(); await fb.A.sendPasswordResetEmail(fb.auth, email); }
export async function reauth(password) {
  const u = fb.auth.currentUser; const cred = fb.A.EmailAuthProvider.credential(u.email, password);
  await fb.A.reauthenticateWithCredential(u, cred);
}
// Future: Google sign-in can be added here with GoogleAuthProvider + signInWithPopup.

export async function deleteAccount(password) {
  await init(); const u = fb.auth.currentUser; if (!u) throw new Error('not signed in');
  await reauth(password);
  // remove the user's cloud saves first (rules allow owner-only deletes)
  const F = fb.F;
  const snap = await F.getDocs(F.collection(fb.db, 'users', u.uid, 'profiles'));
  for (const d of snap.docs) await F.deleteDoc(d.ref);
  await F.deleteDoc(F.doc(fb.db, 'users', u.uid));
  await fb.A.deleteUser(u);
}

// ---- cloud saves: users/{uid}/profiles/{slot} -----------------------------------
export async function listCloudProfiles(uid) {
  await init(); const F = fb.F;
  const snap = await F.getDocs(F.collection(fb.db, 'users', uid, 'profiles'));
  return snap.docs.map(d => d.data().data).filter(Boolean);
}
export async function saveCloudProfile(uid, profile) {
  await init(); const F = fb.F;
  const clean = JSON.parse(JSON.stringify(profile));
  await F.setDoc(F.doc(fb.db, 'users', uid, 'profiles', profile.id), { data: clean, updatedAt: profile.updatedAt, v: 1 });
}
export async function deleteCloudProfile(uid, slot) {
  await init(); const F = fb.F; await F.deleteDoc(F.doc(fb.db, 'users', uid, 'profiles', slot));
}
