import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import { env } from "@/env";

/**
 * Get or initialize the Firebase Admin App.
 * Uses Firebase's built-in getApps() to check for existing instances.
 */
export function getAdminApp(): App {
  console.log("[firebase-admin] getAdminApp called");

  if (getApps().length) {
    console.log("[firebase-admin] Returning existing app from getApps()");
    return getApps()[0];
  }

  try {
    const app = initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY,
      }),
    });
    console.log("[firebase-admin] App initialized successfully");
    return app;
  } catch (error) {
    console.error("[firebase-admin] Error initializing app:", error);
    throw error;
  }
}

/**
 * Get the Firebase Admin Auth instance.
 * Uses the shared Admin App singleton.
 */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
