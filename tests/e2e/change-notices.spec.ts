import { expect, test } from "@playwright/test";
import { Client } from "pg";

test("public notices and push jobs follow commit; delivery requires a scheduler token", async ({ request }) => {
  const listener = new Client({ connectionString: process.env.DATABASE_URL });
  const writer = new Client({ connectionString: process.env.DATABASE_URL });
  const notices: Array<string | undefined> = [];
  try {
    await listener.connect();
    await writer.connect();
    listener.on("notification", (notice) => notices.push(notice.payload));
    await listener.query("LISTEN oscana_public_changes");
    const before = await writer.query("SELECT count(*)::int AS count FROM notification_outbox");

    await writer.query("BEGIN");
    await writer.query(`
      INSERT INTO social_posts (user_id, username, content)
      SELECT id, username, 'E2E rollback probe' FROM users WHERE email = 'reader@oscana.test'
    `);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(notices).toEqual([]);
    await writer.query("ROLLBACK");
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(notices).toEqual([]);
    const afterRollback = await writer.query("SELECT count(*)::int AS count FROM notification_outbox");
    expect(afterRollback.rows[0].count).toBe(before.rows[0].count);

    await writer.query("BEGIN");
    await writer.query(`
      INSERT INTO social_posts (user_id, username, content)
      SELECT id, username, 'E2E commit probe' FROM users WHERE email = 'reader@oscana.test'
    `);
    expect(notices).toEqual([]);
    await writer.query("COMMIT");
    await expect.poll(() => notices, { timeout: 5_000 }).toContain("social");
    const queued = await writer.query("SELECT count(*)::int AS count FROM notification_outbox");
    expect(queued.rows[0].count).toBe(before.rows[0].count + 1);
    expect((await request.post("/api/notification-delivery")).status()).toBe(401);
    const delivery = await request.post("/api/notification-delivery", {
      headers: { "x-internal-cron-token": "isolated-e2e-only" },
    });
    expect(delivery.ok()).toBe(true);
    const processed = await writer.query("SELECT processed_at FROM notification_outbox ORDER BY id DESC LIMIT 1");
    expect(processed.rows[0].processed_at).not.toBeNull();
  } finally {
    await writer.query("ROLLBACK").catch(() => {});
    await writer.end().catch(() => {});
    await listener.end().catch(() => {});
  }
});
