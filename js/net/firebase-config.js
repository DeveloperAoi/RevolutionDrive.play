// ─────────────────────────────────────────────────────────────────────────────
// Firebase web configuration.
// Paste the `firebaseConfig` object from:
//   Firebase console → Project settings → Your apps → Web app → SDK setup and configuration
//
// NOTE: These values are *public identifiers*, not secrets. Security comes from
// Firebase Authentication + the Firestore / Realtime Database security rules in /firebase.
// Never put service-account keys or admin credentials in this repository.
// While this is null the game runs fully offline (GUEST PLAY) and ACCOUNT PLAY shows
// "server not configured".
// ─────────────────────────────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey: "AIzaSyAFAILPYUkX23QidvK8SuffC6CufAJxfMU",
  authDomain: "revolution-drive-39f5a.firebaseapp.com",
  projectId: "revolution-drive-39f5a",
  storageBucket: "revolution-drive-39f5a.firebasestorage.app",
  messagingSenderId: "424366203143",
  appId: "1:424366203143:web:12aeb0cd3f69f439c325a2",
  measurementId: "G-JP138B9LMY",
  // databaseURL: Realtime Database 作成後に追加(オンライン対戦用)
};
/* example:
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxx",
};
*/
export const FIREBASE_SDK_VERSION = '11.10.0';
