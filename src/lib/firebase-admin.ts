/**
 * Firebase Admin SDK – apenas para servidor (API routes, server components).
 * Permite queries ao Firestore no servidor, muito mais rápido que cliente→Firestore.
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let adminApp: App | null = null;

function getAdminApp(): App | null {
  if (adminApp) return adminApp;

  if (getApps().length > 0) {
    adminApp = getApps()[0] as App;
    return adminApp;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  try {
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    return adminApp;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[firebase-admin] init failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function getAdminAuth() {
  const app = getAdminApp();
  return app ? getAuth(app) : null;
}

export function getAdminFirestore() {
  const app = getAdminApp();
  return app ? getFirestore(app) : null;
}
