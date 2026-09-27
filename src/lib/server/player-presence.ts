import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { userEmailEquals } from "@/lib/server/user-email";
import { requireAuthMiddleware } from "@/middleware";

/** A visible, signed-in tab keeps presence fresh without a write per request. */
export const recordPlayerPresence = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    if (!context.user?.email) return;
    const now = new Date();
    await db
      .update(users)
      .set({ lastSeenAt: now, archivedAt: null })
      .where(
        and(
          userEmailEquals(context.user.email),
          or(
            isNull(users.lastSeenAt),
            lt(users.lastSeenAt, new Date(now.getTime() - 60_000)),
            isNotNull(users.archivedAt),
          ),
        ),
      );
  });

/** Only return fields needed to update online/last-seen labels. */
export const getPlayerPresence = createServerFn()
  .inputValidator(
    z.object({ playerId: z.number().int().positive().optional() }),
  )
  .handler(({ data }) =>
    db
      .select({
        id: users.id,
        lastSeenAt: users.lastSeenAt,
        isActive: users.isActive,
        archivedAt: users.archivedAt,
      })
      .from(users)
      .where(data.playerId ? eq(users.id, data.playerId) : undefined),
  );
