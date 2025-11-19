import "server-only";

import { adminAuth } from "@/lib/firebase-admin";

export async function getAuthUserFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const idToken = authHeader.slice(7);
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    try {
      const user = await adminAuth.getUser(decoded.uid);
      if (user.disabled) return null;
    } catch {}
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}
