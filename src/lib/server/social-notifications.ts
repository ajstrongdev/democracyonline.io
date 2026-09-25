import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  parties,
  socialComments,
  socialNotificationDismissals,
  socialPosts,
  users,
} from "@/db/schema";
import { authMiddleware, requireAuthMiddleware } from "@/middleware/auth";
import { userEmailEquals } from "@/lib/server/user-email";
import { getMentionAccounts } from "@/lib/social-notification-accounts";

async function notificationQuery(email: string) {
  const [player] = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(userEmailEquals(email))
    .limit(1);
  if (!player) return null;

  const ledParties = await db
    .select({ id: parties.id, name: parties.name })
    .from(parties)
    .where(
      and(eq(parties.leaderId, player.id), sql`${parties.archivedAt} IS NULL`),
    );
  const accounts = getMentionAccounts(player, ledParties);
  const values = sql.join(
    accounts.map(
      (account) =>
        sql`(${account.key}::text, ${account.label}::text, ${account.pattern}::text)`,
    ),
    sql`, `,
  );

  const eligible = sql`
    WITH accounts(account_key, account_label, pattern) AS (VALUES ${values}),
    mentions AS (
      SELECT accounts.account_key, accounts.account_label,
        'post'::text AS source_type, post.id AS source_id, post.id AS post_id,
        NULL::integer AS comment_id,
        CASE WHEN post.account_key = 'party' THEN coalesce(account_party.name, post.username)
             WHEN post.account_key = 'potro' THEN 'POTRO' ELSE post.username END AS actor_username,
        CASE WHEN post.account_key IS NULL THEN author.photo_url ELSE NULL END AS photo_url,
        post.account_key AS source_account_key, account_party.color AS source_party_color,
        account_party.logo AS source_party_logo,
        post.content AS content, post.created_at AS created_at
      FROM accounts
      JOIN ${socialPosts} post ON post.content ~* accounts.pattern AND (
        post.user_id IS DISTINCT FROM ${player.id}
        OR accounts.account_key <> CASE
          WHEN post.account_key = 'party' THEN 'party:' || coalesce(post.account_party_id::text, 'unknown')
          WHEN post.account_key = 'potro' THEN 'potro'
          ELSE 'player'
        END
      )
      LEFT JOIN ${users} author ON author.id = post.user_id
      LEFT JOIN ${parties} account_party ON account_party.id = post.account_party_id
      UNION ALL
      SELECT accounts.account_key, accounts.account_label,
        'comment'::text AS source_type, comment.id AS source_id, comment.post_id AS post_id,
        comment.id AS comment_id, comment.username AS actor_username,
        author.photo_url AS photo_url, NULL::text AS source_account_key,
        NULL::text AS source_party_color, NULL::text AS source_party_logo,
        comment.content AS content, comment.created_at AS created_at
      FROM accounts
      JOIN ${socialComments} comment ON comment.content ~* accounts.pattern AND (
        comment.user_id IS DISTINCT FROM ${player.id} OR accounts.account_key <> 'player'
      )
      LEFT JOIN ${users} author ON author.id = comment.user_id
    )
    SELECT mentions.* FROM mentions
    WHERE NOT EXISTS (
      SELECT 1 FROM ${socialNotificationDismissals} dismissed
      WHERE dismissed.user_id = ${player.id}
        AND dismissed.account_key = mentions.account_key
        AND dismissed.source_type = mentions.source_type
        AND dismissed.source_id = mentions.source_id
    )
  `;
  return { userId: player.id, eligible };
}

const emptyPage = {
  notifications: 0,
  accounts: 0,
  entries: [] as Array<{
    accountKey: string;
    accountLabel: string;
    sourceType: "post" | "comment";
    sourceId: number;
    postId: number;
    commentId: number | null;
    actorUsername: string;
    photoUrl: string | null;
    sourceAccountKey: string | null;
    sourcePartyColor: string | null;
    sourcePartyLogo: string | null;
    content: string;
    createdAt: Date;
  }>,
  hasMore: false,
};

export const getZNotificationPage = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      limit: z.number().int().min(1).max(50).default(5),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!context.user?.email) return emptyPage;
    const query = await notificationQuery(context.user.email);
    if (!query) return emptyPage;
    const [counts, page] = await Promise.all([
      db.execute(
        sql`SELECT count(*)::int AS notifications, count(distinct account_key)::int AS accounts FROM (${query.eligible}) available`,
      ),
      db.execute(
        sql`SELECT * FROM (${query.eligible}) available ORDER BY created_at DESC, source_type, source_id DESC, account_key LIMIT ${data.limit + 1} OFFSET ${data.offset}`,
      ),
    ]);
    return {
      notifications: Number(counts.rows[0]?.notifications ?? 0),
      accounts: Number(counts.rows[0]?.accounts ?? 0),
      hasMore: page.rows.length > data.limit,
      entries: page.rows.slice(0, data.limit).map((row) => ({
        accountKey: String(row.account_key),
        accountLabel: String(row.account_label),
        sourceType: String(row.source_type) as "post" | "comment",
        sourceId: Number(row.source_id),
        postId: Number(row.post_id),
        commentId: row.comment_id === null ? null : Number(row.comment_id),
        actorUsername: String(row.actor_username),
        photoUrl: row.photo_url === null ? null : String(row.photo_url),
        sourceAccountKey:
          row.source_account_key === null
            ? null
            : String(row.source_account_key),
        sourcePartyColor:
          row.source_party_color === null
            ? null
            : String(row.source_party_color),
        sourcePartyLogo:
          row.source_party_logo === null ? null : String(row.source_party_logo),
        content: String(row.content),
        createdAt: new Date(String(row.created_at)),
      })),
    };
  });

export const dismissZNotifications = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.discriminatedUnion("scope", [
      z.object({ scope: z.literal("all") }),
      z.object({
        scope: z.literal("one"),
        accountKey: z.string(),
        sourceType: z.enum(["post", "comment"]),
        sourceId: z.number().int().positive(),
      }),
    ]),
  )
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const query = await notificationQuery(context.user.email);
    if (!query) throw new Error("Player not found");
    const restriction =
      data.scope === "one"
        ? sql`WHERE account_key = ${data.accountKey} AND source_type = ${data.sourceType} AND source_id = ${data.sourceId}`
        : sql`WHERE true`;
    await db.execute(sql`
      INSERT INTO ${socialNotificationDismissals} (user_id, account_key, source_type, source_id)
      SELECT ${query.userId}, account_key, source_type, source_id
      FROM (${query.eligible}) available ${restriction}
      ON CONFLICT DO NOTHING
    `);
    return { success: true };
  });
