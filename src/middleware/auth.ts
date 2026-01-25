import { createMiddleware } from "@tanstack/react-start";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { getAuth } from "firebase-admin/auth";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/firebase";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAdminApp } from "@/lib/firebase-admin";
import { env } from "@/env";

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
          secure: env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
      }
    } catch (error) {
      console.error("Error updating user activity:", error);
    }

    return next();
  });
