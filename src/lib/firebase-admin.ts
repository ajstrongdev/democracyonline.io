import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";

let adminApp: App | undefined;

/**
 * Get or initialize the Firebase Admin App singleton.
 * This ensures only one instance of the Firebase Admin SDK is created.
 */
export function getAdminApp(): App {
  console.log("[firebase-admin] getAdminApp called");

  if (adminApp) {
    console.log("[firebase-admin] Returning cached adminApp instance");
    return adminApp;
  }

  if (getApps().length) {
    console.log("[firebase-admin] Returning existing app from getApps()");
    return getApps()[0];
  }

  const useCert = process.env.IS_DEPLOYED_ENV === "false";
  console.log(
    `[firebase-admin] Initializing new app with ${useCert ? "cert" : "applicationDefault"} credentials`,
  );

  try {
    adminApp = initializeApp({
      credential: useCert
        ? cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, ""),
          })
        : applicationDefault(), // Uses Cloud Run's default credentials
    });
    console.log("[firebase-admin] App initialized successfully");
  } catch (error) {
    console.error("[firebase-admin] Error initializing app:", error);
    throw error;
  }

  return adminApp;
}

/**
 * Get the Firebase Admin Auth instance.
 * Uses the shared Admin App singleton.
 */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
