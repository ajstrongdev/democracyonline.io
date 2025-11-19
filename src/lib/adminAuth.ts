import { NextRequest } from "next/server";
import { adminAuth } from "./firebase-admin";

const ALLOWED_ADMIN_EMAILS = [
  "jenewland1999@gmail.com",
  "ajstrongdev@pm.me",
  "robertjenner5@outlook.com",
  "spam@hpsaucii.dev",
];

/**
 * Verify admin access by checking the Firebase ID token from the Authorization header
 * @param request - The Next.js request object
 * @returns The verified user email if admin, null otherwise
 */
export async function verifyAdminAccess(
  request: NextRequest
): Promise<string | null> {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Check if the email is in the allowed list
    if (
      decodedToken.email &&
      ALLOWED_ADMIN_EMAILS.includes(decodedToken.email)
    ) {
      return decodedToken.email;
    }

    return null;
  } catch (error) {
    console.error("Admin verification error:", error);
    return null;
  }
}

export { ALLOWED_ADMIN_EMAILS };
