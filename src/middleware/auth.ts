import { createMiddleware } from "@tanstack/react-start";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { App } from "firebase-admin/app";
import { auth } from "@/lib/firebase";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

let adminApp: App | undefined;

function formatPrivateKey(key: string): string {
  // Handle different formats of the private key:
  // 1. JSON-escaped with \\n (from .env files)
  // 2. Literal \n characters (from some cloud providers)
  // 3. Already formatted with actual newlines

  // First, try to handle JSON-escaped format
  let formatted = key.replace(/\\n/g, "\n");

  // If the key doesn't start with the expected header, it might need different handling
  if (!formatted.includes("-----BEGIN")) {
    // Try parsing as JSON string (some providers wrap it in quotes)
    try {
      formatted = JSON.parse(key);
    } catch {
      // If that fails, just use the original replacement
    }
  }

  return formatted;
}

function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length) return getApps()[0];

  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  console.log("[getAdminApp] FIREBASE_PRIVATE_KEY exists:", !!privateKey);
  console.log("[getAdminApp] FIREBASE_PRIVATE_KEY length:", privateKey?.length);
  console.log(
    "[getAdminApp] FIREBASE_PRIVATE_KEY starts with:",
    privateKey?.substring(0, 50),
  );

  if (!privateKey) {
    throw new Error("FIREBASE_PRIVATE_KEY environment variable is not set");
  }

  const formattedKey = formatPrivateKey(privateKey);
  console.log(
    "[getAdminApp] Formatted key starts with:",
    formattedKey.substring(0, 50),
  );
  console.log(
    "[getAdminApp] Formatted key includes BEGIN:",
    formattedKey.includes("-----BEGIN"),
  );

  adminApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: formattedKey,
    }),
  });

  return adminApp;
}

export interface AuthContext {
  user: {
    uid: string;
    email?: string;
  } | null;
}

export const authMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const user = auth.currentUser;
    console.log("[authMiddleware.client] currentUser:", user?.email);

    if (!user) return next();

    const token = await user.getIdToken();
    console.log("[authMiddleware.client] Got token, sending with request");
    return next({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  })
  .server(async ({ next }) => {
    try {
      const request = getRequest();
      // console.log("[authMiddleware.server] Request URL:", request?.url);
      // console.log(
      //   "[authMiddleware.server] Request headers:",
      //   request?.headers ? Object.fromEntries(request.headers.entries()) : null,
      // );

      // First, try to get token from session cookie (for SSR)
      const sessionCookie = getCookie("__session");
      console.log(
        "[authMiddleware.server] Session cookie exists:",
        !!sessionCookie,
      );
      if (sessionCookie) {
        try {
          const decoded = await getAuth(getAdminApp()).verifySessionCookie(
            sessionCookie,
            true,
          );
          console.log(
            "[authMiddleware.server] Session cookie verified, email:",
            decoded.email,
          );
          return next({
            context: {
              user: {
                uid: decoded.uid,
                email: decoded.email,
              },
            } as AuthContext,
          });
        } catch (error) {
          console.error("Session cookie verification failed:", error);
          // Continue to check Authorization header
        }
      }

      // Fall back to Authorization header (for client-side API calls)
      const authHeader = request.headers.get("authorization");
      console.log("[authMiddleware.server] Has auth header:", !!authHeader);

      if (!authHeader?.startsWith("Bearer ")) {
        console.log(
          "[authMiddleware.server] No valid auth, returning null user",
        );
        return next({ context: { user: null } as AuthContext });
      }

      const token = authHeader.slice(7);
      const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
      console.log(
        "[authMiddleware.server] Token verified, email:",
        decoded.email,
      );

      return next({
        context: {
          user: {
            uid: decoded.uid,
            email: decoded.email,
          },
        } as AuthContext,
      });
    } catch (error) {
      console.error("Auth middleware error:", error);
      return next({ context: { user: null } as AuthContext });
    }
  });

export const requireAuthMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (!context.user) {
      throw new Error("Authentication required");
    }

    return next();
  });

const activityCookieName = "user_activity_updated";
const activityCookieMaxAge = 60 * 60;

export const userActivityMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (!context.user?.email) {
      return next();
    }

    try {
      const activityCookie = getCookie(activityCookieName);

      if (!activityCookie) {
        await db
          .update(users)
          .set({
            lastActivity: 0,
            isActive: true,
          })
          .where(eq(users.email, context.user.email));

        setCookie(activityCookieName, "1", {
          maxAge: activityCookieMaxAge,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
      }
    } catch (error) {
      console.error("Error updating user activity:", error);
    }

    return next();
  });
