// Firebase JS SDK phía trình duyệt — chỉ dùng để đăng nhập Google.
// Sau khi đăng nhập, server đổi ID token thành cookie phiên; trình duyệt không giữ phiên Firebase.

import { getApps, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
  type Auth,
} from "firebase/auth";

let _auth: Auth | null = null;

function clientAuth(): Auth {
  if (_auth) return _auth;
  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  _auth = getAuth(app);
  const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulatorHost) connectAuthEmulator(_auth, `http://${emulatorHost}`, { disableWarnings: true });
  return _auth;
}

/** Mở cửa sổ đăng nhập Google rồi đổi kết quả thành cookie phiên ở server. */
export async function signInWithGoogle(): Promise<void> {
  const auth = clientAuth();
  // Không lưu phiên Firebase trong trình duyệt — cookie phiên ở server là nguồn duy nhất.
  await setPersistence(auth, inMemoryPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  try {
    const idToken = await credential.user.getIdToken();
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Không tạo được phiên đăng nhập.");
    }
  } finally {
    await signOut(auth);
  }
}

export async function signOutSession(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
