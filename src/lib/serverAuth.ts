import { cookies } from "next/headers";
import { adminAuth } from "./firebase-admin";

const ALLOWED_ADMIN_EMAILS = [
  "jenewland1999@gmail.com",
  "ajstrongdev@pm.me",
  "robertjenner5@outlook.com",
  "spam@hpsaucii.dev",
];

export async function getServerSession() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("__session");

    if (!sessionToken?.value) {
      return null;
    }

    // Verify the session cookie
    const decodedToken = await adminAuth.verifySessionCookie(
      sessionToken.value,
      true
    );

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
    };
  } catch (error) {
    console.error("Session verification error:", error);
    return null;
  }
}

export async function isAdmin(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  return ALLOWED_ADMIN_EMAILS.includes(email);
}

export { ALLOWED_ADMIN_EMAILS };
