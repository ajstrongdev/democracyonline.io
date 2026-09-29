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
    const emulator = env.FIREBASE_AUTH_EMULATOR_HOST;
    if (emulator && !env.FIREBASE_PROJECT_ID.startsWith("demo-")) {
      throw new Error("Firebase Auth emulator requires an isolated demo- project");
    }
    if (!emulator && (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY)) {
      throw new Error("Firebase service account credentials are required outside the emulator");
    }
    const app = initializeApp(emulator
      ? { projectId: env.FIREBASE_PROJECT_ID }
      : {
          credential: cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL!,
            privateKey: env.FIREBASE_PRIVATE_KEY!,
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
