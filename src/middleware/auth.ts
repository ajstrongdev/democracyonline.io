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

function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length) return getApps()[0];

  adminApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
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

    if (!user) return next();

    const token = await user.getIdToken();
    return next({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  })
  .server(async ({ next }) => {
    try {
      const request = getRequest();

      // First, try to get token from session cookie (for SSR)
      const sessionCookie = getCookie("__session");
      if (sessionCookie) {
        try {
          const decoded = await getAuth(getAdminApp()).verifySessionCookie(
            sessionCookie,
            true,
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
      const authHeader = request?.headers?.get("authorization");

      if (!authHeader?.startsWith("Bearer ")) {
        return next({ context: { user: null } as AuthContext });
      }

      const token = authHeader.slice(7);
      const decoded = await getAuth(getAdminApp()).verifyIdToken(token);

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
    if (!context?.user) {
      throw new Error("Authentication required");
    }

    return next();
  });

const activityCookieName = "user_activity_updated";
const activityCookieMaxAge = 60 * 60;

export const userActivityMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (!context?.user?.email) {
      return next();
    }

    try {
      const activityCookie = getCookie(activityCookieName);

      if (!activityCookie) {
        await db
          .update(users)
          .set({
            lastActivity: Date.now(),
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
