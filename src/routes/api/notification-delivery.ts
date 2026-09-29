import { createFileRoute } from "@tanstack/react-router";
import { env } from "@/env";

export const Route = createFileRoute("/api/notification-delivery")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!env.CRON_INTERNAL_TOKEN ||
          request.headers.get("x-internal-cron-token") !== env.CRON_INTERNAL_TOKEN) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        try {
          if (request.headers.get("x-notification-scan") === "actions") {
            const { dispatchNextMovePush } = await import("@/lib/server/notifications/next-move-delivery");
            return Response.json(await dispatchNextMovePush());
          }
          const { dispatchMentionPushBatch } = await import("@/lib/server/notifications/push-delivery");
          return Response.json(await dispatchMentionPushBatch());
        } catch (error) {
          console.error("Notification delivery job failed", error);
          return Response.json({ error: "Delivery failed" }, { status: 503 });
        }
      },
    },
  },
});
