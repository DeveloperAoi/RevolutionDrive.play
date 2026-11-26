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
export const firebaseConfig = null;
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
