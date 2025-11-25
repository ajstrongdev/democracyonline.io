import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Helper function to properly format the private key
// Handles various formats the key might be stored in (escaped, double-escaped, etc.)
function formatPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;

  let formattedKey = key;

  // If the key is JSON-encoded (wrapped in quotes), parse it
  if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
    try {
      formattedKey = JSON.parse(formattedKey);
    } catch {
      // If parsing fails, continue with the original key
    }
  }

  // Replace literal \n strings with actual newlines
  // This handles both single-escaped (\\n) and the literal string (\n)
  return formattedKey.replace(/\\n/g, "\n");
}

// Initialize Firebase Admin SDK
const apps = getApps();
if (!apps.length) {
  const privateKey = formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  if (
    !process.env.FIREBASE_ADMIN_PROJECT_ID ||
    !process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    !privateKey
  ) {
    console.error("Firebase Admin SDK credentials are missing or invalid:", {
      hasProjectId: !!process.env.FIREBASE_ADMIN_PROJECT_ID,
      hasClientEmail: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      hasPrivateKey: !!privateKey,
    });
  }

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

const adminAuth = getAuth();

export { adminAuth };
