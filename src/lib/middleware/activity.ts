import { createMiddleware } from "@tanstack/react-start";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { accounts, politicians } from "@/db/schema";
import { accountEmailEquals } from "@/lib/server/account-email";
import { authMiddleware } from "@/lib/middleware/auth";
import { env } from "@/env";

// Tracked per nation so a player can be idle in one game but not their account.
const activityCookiePrefix = "politician_activity_updated";
const activityCookieMaxAge = 60 * 60;

// Client sends the active nation in this header.
function resolveNationId(): number | null {
  const request = getRequest();
  const header = request.headers.get("x-nation-id");
  if (!header) return null;

  const nationId = Number.parseInt(header, 10);
  return Number.isInteger(nationId) && nationId > 0 ? nationId : null;
}

export const politicianActivityMiddleware = createMiddleware({
  type: "function",
})
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (!context.user?.email) {
      return next();
    }

    const nationId = resolveNationId();
    if (nationId === null) {
      return next();
    }

    try {
      const activityCookieName = `${activityCookiePrefix}_${nationId}`;
      const activityCookie = getCookie(activityCookieName);

      // Skip if we already recorded activity for this nation recently.
      if (activityCookie) {
        return next();
      }

      const matchingAccounts = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(accountEmailEquals(context.user.email))
        .limit(2);

      if (matchingAccounts.length > 1) {
        console.error(
          "Refusing to update activity for duplicate case-insensitive account email:",
          context.user.email,
        );
        return next();
      }

      if (matchingAccounts.length === 0) {
        return next();
      }

      const accountId = matchingAccounts[0].id;

      const updated = await db
        .update(politicians)
        .set({ lastActiveAt: new Date() })
        .where(
          and(
            eq(politicians.accountId, accountId),
            eq(politicians.nationId, nationId),
            isNull(politicians.retiredAt),
          ),
        )
        .returning({ id: politicians.id });

      // No politician in this nation, nothing to track.
      if (updated.length === 0) {
        return next();
      }

      setCookie(activityCookieName, "1", {
        maxAge: activityCookieMaxAge,
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
    } catch (error) {
      console.error("Error updating politician activity:", error);
    }

    return next();
  });
