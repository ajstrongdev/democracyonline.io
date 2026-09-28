import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notificationNextMoveReceipts, notificationPreferences, notificationPushSubscriptions, users } from "@/db/schema";
import { nextMovePushPayload } from "@/lib/notifications/push-payload";
import { inQuietHours } from "@/lib/notifications/push-policy";
import { getPendingNextMoves } from "@/lib/server/dashboard/next-moves";
import { pushConfiguration } from "@/lib/server/notifications/preferences";
import { sendPushToBrowser } from "@/lib/server/notifications/push-delivery";

export async function dispatchNextMovePush() {
  const config = pushConfiguration();
  if (!config) return { checked: 0, handled: 0 };
  const rows = await db.select({
    id: notificationPushSubscriptions.id,
    userId: users.id,
    email: users.email,
    endpoint: notificationPushSubscriptions.endpoint,
    p256dh: notificationPushSubscriptions.p256dh,
    auth: notificationPushSubscriptions.auth,
    preview: notificationPreferences.pushPreview,
    quietStart: notificationPreferences.quietStart,
    quietEnd: notificationPreferences.quietEnd,
    timeZone: notificationPreferences.timeZone,
  }).from(notificationPushSubscriptions)
    .innerJoin(users, eq(users.id, notificationPushSubscriptions.userId))
    .innerJoin(notificationPreferences, eq(notificationPreferences.userId, users.id))
    .where(and(eq(users.isActive, true), eq(notificationPreferences.pushNextMoves, true)));

  const recipients = new Map<number, typeof rows>();
  for (const row of rows) {
    const subscriptions = recipients.get(row.userId) ?? [];
    subscriptions.push(row);
    recipients.set(row.userId, subscriptions);
  }

  let handled = 0;
  for (const subscriptions of recipients.values()) {
    const player = subscriptions[0];
    try {
      const moves = await getPendingNextMoves(player.email);
      if (!moves.length) continue;
      const existing = await db.select({ key: notificationNextMoveReceipts.actionKey })
        .from(notificationNextMoveReceipts)
        .where(and(eq(notificationNextMoveReceipts.userId, player.userId),
          inArray(notificationNextMoveReceipts.actionKey, moves.map((move) => move.key))));
      const sent = new Set(existing.map((receipt) => receipt.key));
      for (const move of moves) {
        if (sent.has(move.key)) continue;
        if (!inQuietHours(new Date(), player)) {
          const payload = nextMovePushPayload({ ...move, preview: player.preview });
          for (const subscription of subscriptions) {
            await sendPushToBrowser(subscription, payload, config);
          }
        }
        // Quiet hours skip rather than defer. A retry uses the same browser tag.
        await db.insert(notificationNextMoveReceipts).values({ userId: player.userId, actionKey: move.key })
          .onConflictDoNothing();
        handled++;
      }
    } catch (error) {
      console.error("Could not check next moves for a player", { userId: player.userId, error });
      // Continue with other players; the next scan retries this one.
    }
  }
  return { checked: recipients.size, handled };
}
