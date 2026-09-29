import webpush from "web-push";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  notificationOutbox,
  notificationPreferences,
  notificationPushSubscriptions,
  socialComments,
  socialPosts,
  users,
} from "@/db/schema";
import { inQuietHours, isTrustedPushEndpoint } from "@/lib/notifications/push-policy";
import { mentionPushPayload } from "@/lib/notifications/push-payload";
import { pushConfiguration } from "@/lib/server/notifications/preferences";
import { notificationQuery } from "@/lib/server/notifications/social-notifications";

type PendingEvent = { id: number; source_type: string; source_id: number; attempts: number };

export async function sendPushToBrowser(
  subscription: { id: number; endpoint: string; p256dh: string; auth: string },
  payload: string,
  config: NonNullable<ReturnType<typeof pushConfiguration>>,
) {
  // Validate again at the network boundary, including old DB rows.
  if (!isTrustedPushEndpoint(subscription.endpoint)) return;
  try {
    await webpush.sendNotification({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    }, payload, {
      vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
      TTL: 300,
      timeout: 5_000,
    });
  } catch (error) {
    if (error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
      await db.delete(notificationPushSubscriptions).where(eq(notificationPushSubscriptions.id, subscription.id));
    } else {
      throw error;
    }
  }
}

async function deliver(event: PendingEvent) {
  const config = pushConfiguration();
  // Deliberately do not replay weeks of historical posts if Web Push is enabled later.
  if (!config) return;
  if (event.source_type !== "post" && event.source_type !== "comment") return;

  const [source] = event.source_type === "post"
    ? await db.select({ postId: socialPosts.id, content: socialPosts.content })
      .from(socialPosts).where(eq(socialPosts.id, event.source_id)).limit(1)
    : await db.select({ postId: socialComments.postId, content: socialComments.content })
      .from(socialComments).where(eq(socialComments.id, event.source_id)).limit(1);
  if (!source) return; // Deleted before delivery.

  const subscriptions = await db.select({
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
    .where(and(eq(notificationPreferences.pushMentions, true), eq(users.isActive, true)));

  const recipients = new Map<number, typeof subscriptions>();
  for (const subscription of subscriptions) {
    const group = recipients.get(subscription.userId) ?? [];
    group.push(subscription);
    recipients.set(subscription.userId, group);
  }
  for (const group of recipients.values()) {
    const player = group[0];
    if (inQuietHours(new Date(), player)) continue;
    const mention = await notificationQuery(player.email);
    if (!mention) continue;
    const match = await db.execute(sql`
      SELECT 1 FROM (${mention.eligible}) available
      WHERE source_type = ${event.source_type} AND source_id = ${event.source_id} LIMIT 1
    `);
    if (!match.rows.length) continue;

    const payload = mentionPushPayload({
      sourceType: event.source_type,
      sourceId: event.source_id,
      postId: source.postId,
      content: source.content,
      preview: player.preview,
    });
    for (const subscription of group) {
      // Retry the source after a transient error, without affecting the social transaction.
      await sendPushToBrowser(subscription, payload, config);
    }
  }
}

export async function dispatchMentionPushBatch() {
  const claimed = await db.execute(sql`
    WITH next AS (
      SELECT id FROM notification_outbox
      WHERE processed_at IS NULL AND available_at <= now()
        AND (locked_until IS NULL OR locked_until < now())
      ORDER BY id LIMIT 10 FOR UPDATE SKIP LOCKED
    )
    UPDATE notification_outbox outbox
    SET locked_until = now() + interval '5 minutes', attempts = outbox.attempts + 1
    FROM next WHERE outbox.id = next.id
    RETURNING outbox.id, outbox.source_type, outbox.source_id, outbox.attempts
  `);
  let delivered = 0;
  for (const row of claimed.rows) {
    const event = {
      id: Number(row.id),
      source_type: String(row.source_type),
      source_id: Number(row.source_id),
      attempts: Number(row.attempts),
    };
    try {
      await deliver(event);
      await db.update(notificationOutbox)
        .set({ processedAt: new Date(), lockedUntil: null })
        .where(eq(notificationOutbox.id, event.id));
      delivered++;
    } catch (error) {
      console.error("Mention delivery failed", { outboxId: event.id, attempts: event.attempts, error });
      await db.execute(sql`
        UPDATE notification_outbox SET
          locked_until = NULL,
          available_at = now() + interval '1 minute' * ${Math.min(60, 2 ** event.attempts)},
          processed_at = CASE WHEN ${event.attempts} >= 5 THEN now() ELSE NULL END
        WHERE id = ${event.id}
      `);
    }
  }
  return { claimed: claimed.rows.length, delivered };
}
