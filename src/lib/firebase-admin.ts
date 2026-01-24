import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";

let adminApp: App | undefined;

/**
 * Get or initialize the Firebase Admin App singleton.
 * This ensures only one instance of the Firebase Admin SDK is created.
 */
export function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length) return getApps()[0];

  adminApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!,
    }),
  });

  return adminApp;
}

/**
 * Get the Firebase Admin Auth instance.
 * Uses the shared Admin App singleton.
 */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
