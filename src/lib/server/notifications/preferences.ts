import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notificationPreferences, notificationPushSubscriptions, users } from "@/db/schema";
import { env } from "@/env";
import { isTrustedPushEndpoint, isValidTimeZone } from "@/lib/notifications/push-policy";
import { userEmailEquals } from "@/lib/server/auth/user-email";
import { requireAuthMiddleware } from "@/middleware/auth";

const defaults = {
  pushMentions: false,
  pushNextMoves: false,
  pushPreview: false,
  quietStart: null as number | null,
  quietEnd: null as number | null,
  timeZone: "UTC",
};

async function playerId(email: string) {
  const [player] = await db.select({ id: users.id, isActive: users.isActive })
    .from(users).where(userEmailEquals(email)).limit(1);
  if (!player || player.isActive === false) throw new Error("Active player required");
  return player.id;
}

export function pushConfiguration() {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY ||
      !env.VAPID_SUBJECT?.match(/^(mailto:|https:\/\/)/)) return null;
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };
}

export const getNotificationSettings = createServerFn()
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    const id = await playerId(context.user!.email!);
    const [row] = await db.select().from(notificationPreferences)
      .where(eq(notificationPreferences.userId, id)).limit(1);
    const [subscriptions] = await db.select({ count: sql<number>`count(*)::int` })
      .from(notificationPushSubscriptions)
      .where(eq(notificationPushSubscriptions.userId, id));
    return {
      ...defaults,
      ...(row && {
        pushMentions: row.pushMentions,
        pushNextMoves: row.pushNextMoves,
        pushPreview: row.pushPreview,
        quietStart: row.quietStart,
        quietEnd: row.quietEnd,
        timeZone: row.timeZone,
      }),
      subscriptionCount: subscriptions.count,
      vapidPublicKey: pushConfiguration()?.publicKey ?? null,
    };
  });

export const saveNotificationSettings = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(z.object({
    pushMentions: z.boolean(),
    pushNextMoves: z.boolean(),
    pushPreview: z.boolean(),
    quietStart: z.number().int().min(0).max(1439).nullable(),
    quietEnd: z.number().int().min(0).max(1439).nullable(),
    timeZone: z.string().min(1).max(100),
  }).refine((value) => (value.quietStart === null && value.quietEnd === null) ||
    (value.quietStart !== null && value.quietEnd !== null && value.quietStart !== value.quietEnd),
  "Choose a start and end time, or disable quiet hours").refine((value) => isValidTimeZone(value.timeZone), "Invalid time zone"))
  .handler(async ({ data, context }) => {
    const id = await playerId(context.user!.email!);
    if ((data.pushMentions || data.pushNextMoves) && !pushConfiguration()) throw new Error("Web Push is unavailable");
    if (data.pushMentions || data.pushNextMoves) {
      const [subscriptions] = await db.select({ count: sql<number>`count(*)::int` })
        .from(notificationPushSubscriptions).where(eq(notificationPushSubscriptions.userId, id));
      if (!subscriptions.count) throw new Error("Enable Web Push on a browser first");
    }
    await db.transaction(async (tx) => {
      await tx.insert(notificationPreferences).values({ userId: id, ...data, updatedAt: new Date() })
        .onConflictDoUpdate({ target: notificationPreferences.userId, set: { ...data, updatedAt: new Date() } });
      if (!data.pushMentions && !data.pushNextMoves) {
        await tx.delete(notificationPushSubscriptions).where(eq(notificationPushSubscriptions.userId, id));
      }
    });
    return { success: true };
  });

const subscriptionInput = z.object({
  endpoint: z.string().url().max(2048).refine(isTrustedPushEndpoint, "Unsupported push service"),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,120}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{18,40}$/),
  }),
});

export const registerPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(subscriptionInput)
  .handler(async ({ data, context }) => {
    if (!pushConfiguration()) throw new Error("Web Push is unavailable");
    const id = await playerId(context.user!.email!);
    await db.transaction(async (tx) => {
      const [existing] = await tx.select({ userId: notificationPushSubscriptions.userId })
        .from(notificationPushSubscriptions)
        .where(eq(notificationPushSubscriptions.endpoint, data.endpoint)).limit(1);
      if (existing && existing.userId !== id) throw new Error("Reset this browser's push subscription before enabling it for another account");
      if (existing) {
        await tx.update(notificationPushSubscriptions)
          .set({ p256dh: data.keys.p256dh, auth: data.keys.auth })
          .where(and(eq(notificationPushSubscriptions.endpoint, data.endpoint), eq(notificationPushSubscriptions.userId, id)));
      } else {
        const [count] = await tx.select({ count: sql<number>`count(*)::int` })
          .from(notificationPushSubscriptions)
          .where(eq(notificationPushSubscriptions.userId, id));
        if (count.count >= 5) throw new Error("Remove an old device before adding another (maximum five)");
        await tx.insert(notificationPushSubscriptions).values({
          userId: id, endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth,
        });
      }
      await tx.insert(notificationPreferences).values({ userId: id, pushMentions: true, pushNextMoves: true })
        .onConflictDoUpdate({ target: notificationPreferences.userId, set: { pushMentions: true, pushNextMoves: true, updatedAt: new Date() } });
    });
    return { success: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(z.object({ endpoint: z.string().url().max(2048) }))
  .handler(async ({ data, context }) => {
    const id = await playerId(context.user!.email!);
    await db.delete(notificationPushSubscriptions).where(and(
      eq(notificationPushSubscriptions.userId, id), eq(notificationPushSubscriptions.endpoint, data.endpoint),
    ));
    return { success: true };
  });
