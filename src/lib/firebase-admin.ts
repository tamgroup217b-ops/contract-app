// Firebase Admin SDK — chỉ dùng phía server.
// Trên Firebase App Hosting tự xác thực bằng tài khoản dịch vụ của backend (không cần key).
// Máy local: đặt FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST để dùng Firebase Emulator,
// hoặc GOOGLE_APPLICATION_CREDENTIALS để kết nối project thật.

import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function adminApp(): App {
  return (
    getApps()[0] ??
    initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    })
  );
}

export const adminAuth = () => getAuth(adminApp());
export const firestore = () => getFirestore(adminApp());
