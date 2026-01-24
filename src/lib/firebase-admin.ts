import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";

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

  const useCert = process.env.IS_DEPLOYED_ENV === "false";
  console.log(
    `[firebase-admin] Initializing new app with ${useCert ? "cert" : "applicationDefault"} credentials`,
  );

  try {
    console.log(
      "[firebase-admin] [credentials] projectId:",
      process.env.FIREBASE_PROJECT_ID,
    );
    console.log(
      "[firebase-admin] [credentials] clientEmail:",
      process.env.FIREBASE_CLIENT_EMAIL,
    );
    console.log(
      "[firebase-admin] [credentials] privateKey:",
      process.env.FIREBASE_PRIVATE_KEY,
    );
    const app = initializeApp({
      credential: useCert
        ? cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(
              /\\n/gm,
              "\n",
            ),
          })
        : applicationDefault(), // Uses Cloud Run's default credentials
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
