import { createServerFn } from "@tanstack/react-start";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { SuspicionAssessment } from "@/lib/moderation/suspicion";
import { db } from "@/db";
import {
  moderationAuditLog,
  moderationFlags,
  playerReports,
  users,
} from "@/db/schema";
import { calculateSuspicion } from "@/lib/moderation/suspicion";
import { isAdminEmail } from "@/lib/server/admin";
import { getCurrentDatabaseUser } from "@/lib/server/current-user";
import { requireAuthMiddleware } from "@/middleware";

const reportCategories = [
  "harassment",
  "spam",
  "impersonation",
  "vote_manipulation",
  "other",
] as const;

function asSuspicionAssessment(value: unknown): SuspicionAssessment {
  return value as SuspicionAssessment;
}

async function requireModerator(
  identity: { uid: string; email?: string } | null,
) {
  if (!identity) throw new Error("Authentication required");
  const user = await getCurrentDatabaseUser(identity);
  const isAdmin = Boolean(
    user?.moderationRole === "admin" ||
    (identity.email && isAdminEmail(identity.email)),
  );
  if (!user || (!isAdmin && user.moderationRole !== "moderator")) {
    throw new Error("Moderator access required");
  }
  return { user, role: isAdmin ? ("admin" as const) : ("moderator" as const) };
}

async function getSuspicionAssessment(userId: number) {
  const result = await db.execute(sql`
    WITH RECURSIVE ancestry AS (
      SELECT invitation.inviter_id AS user_id, 1 AS depth
      FROM player_invitations invitation
      WHERE invitation.redeemed_by_user_id = ${userId}
      UNION ALL
      SELECT parent.inviter_id, ancestry.depth + 1
      FROM ancestry
      JOIN player_invitations parent
        ON parent.redeemed_by_user_id = ancestry.user_id
      WHERE ancestry.depth < 20
    ), redeemed_invitation AS (
      SELECT inviter_id, created_at, redeemed_at
      FROM player_invitations
      WHERE redeemed_by_user_id = ${userId}
      LIMIT 1
    )
    SELECT
      CASE WHEN target.redeemed_at IS NULL THEN NULL
        ELSE extract(epoch FROM (target.redeemed_at - target.created_at)) / 60
      END AS redemption_minutes,
      (SELECT count(*)::int
       FROM player_invitations sibling
       WHERE sibling.inviter_id = target.inviter_id
         AND sibling.redeemed_at BETWEEN target.redeemed_at - interval '24 hours'
           AND target.redeemed_at) AS inviter_redemptions,
      coalesce((SELECT max(depth) FROM ancestry), 0)::int AS ancestry_depth,
      (SELECT count(DISTINCT reporter_id)::int
       FROM player_reports
       WHERE reported_user_id = ${userId} AND status = 'pending') AS reporters
    FROM (SELECT 1) seed
    LEFT JOIN redeemed_invitation target ON true
  `);
  const row = result.rows[0] as {
    redemption_minutes: null | number | string;
    inviter_redemptions: number;
    ancestry_depth: number;
    reporters: number;
  };
  return calculateSuspicion({
    redemptionMinutes:
      row.redemption_minutes === null ? null : Number(row.redemption_minutes),
    inviterRedemptionsIn24Hours: Number(row.inviter_redemptions),
    ancestryDepth: Number(row.ancestry_depth),
    distinctPendingReporters: Number(row.reporters),
  });
}

export async function refreshAutomaticFlag(userId: number) {
  const assessment = await getSuspicionAssessment(userId);
  if (!assessment.shouldFlag) return assessment;
  const [openFlag] = await db
    .select({ id: moderationFlags.id })
    .from(moderationFlags)
    .where(
      and(
        eq(moderationFlags.userId, userId),
        eq(moderationFlags.status, "open"),
        eq(moderationFlags.source, "automatic"),
      ),
    )
    .limit(1);
  if (openFlag) {
    await db
      .update(moderationFlags)
      .set({ suspicionScore: assessment.score, explanation: assessment })
      .where(eq(moderationFlags.id, openFlag.id));
  } else {
    await db.insert(moderationFlags).values({
      userId,
      suspicionScore: assessment.score,
      explanation: assessment,
    });
  }
  return assessment;
}

export const reportPlayer = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      reportedUserId: z.number().int().positive(),
      category: z.enum(reportCategories),
      details: z.string().trim().min(10).max(2_000),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user) throw new Error("Authentication required");
    const reporter = await getCurrentDatabaseUser(context.user);
    if (!reporter || !reporter.isActive)
      throw new Error("Active player required");
    if (reporter.id === data.reportedUserId)
      throw new Error("You cannot report yourself");
    const [reportedUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, data.reportedUserId))
      .limit(1);
    if (!reportedUser) throw new Error("Player not found");
    const [duplicate] = await db
      .select({ id: playerReports.id })
      .from(playerReports)
      .where(
        and(
          eq(playerReports.reporterId, reporter.id),
          eq(playerReports.reportedUserId, data.reportedUserId),
          eq(playerReports.status, "pending"),
        ),
      )
      .limit(1);
    if (duplicate)
      throw new Error("You already have a pending report for this player");

    await db.insert(playerReports).values({
      reporterId: reporter.id,
      reportedUserId: data.reportedUserId,
      category: data.category,
      details: data.details,
    });
    await refreshAutomaticFlag(data.reportedUserId);
    return { success: true };
  });

export const getModerationAccess = createServerFn()
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    try {
      const access = await requireModerator(context.user);
      return { allowed: true, role: access.role };
    } catch {
      return { allowed: false, role: "player" as const };
    }
  });

export const getModerationQueue = createServerFn()
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    await requireModerator(context.user);
    const reports = await db.execute(sql`
      SELECT report.id, report.reported_user_id, report.category, report.details,
        report.created_at, reported.username AS reported_username,
        reporter.username AS reporter_username
      FROM player_reports report
      JOIN users reported ON reported.id = report.reported_user_id
      JOIN users reporter ON reporter.id = report.reporter_id
      WHERE report.status = 'pending'
      ORDER BY report.created_at ASC
    `);
    const flags = await db.execute(sql`
      SELECT flag.id, flag.user_id, flag.suspicion_score, flag.explanation,
        flag.created_at, users.username
      FROM moderation_flags flag
      JOIN users ON users.id = flag.user_id
      WHERE flag.status = 'open'
      ORDER BY flag.suspicion_score DESC, flag.created_at ASC
    `);
    return {
      reports: reports.rows.map((row) => ({
        id: Number(row.id),
        reportedUserId: Number(row.reported_user_id),
        category: String(row.category),
        details: String(row.details),
        createdAt: new Date(String(row.created_at)),
        reportedUsername: String(row.reported_username),
        reporterUsername: String(row.reporter_username),
      })),
      flags: flags.rows.map((row) => ({
        id: Number(row.id),
        userId: Number(row.user_id),
        suspicionScore: Number(row.suspicion_score),
        explanation: asSuspicionAssessment(row.explanation),
        createdAt: new Date(String(row.created_at)),
        username: String(row.username),
      })),
    };
  });

export const getInvitationAncestry = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator(z.object({ userId: z.number().int().positive() }))
  .handler(async ({ context, data }) => {
    await requireModerator(context.user);
    const result = await db.execute(sql`
      WITH RECURSIVE ancestry AS (
        SELECT invitation.inviter_id AS user_id, 1 AS depth,
          invitation.created_at, invitation.redeemed_at
        FROM player_invitations invitation
        WHERE invitation.redeemed_by_user_id = ${data.userId}
        UNION ALL
        SELECT parent.inviter_id, ancestry.depth + 1,
          parent.created_at, parent.redeemed_at
        FROM ancestry
        JOIN player_invitations parent
          ON parent.redeemed_by_user_id = ancestry.user_id
        WHERE ancestry.depth < 20
      )
      SELECT ancestry.depth, ancestry.created_at, ancestry.redeemed_at,
        users.id, users.username, users.is_ancestry_root
      FROM ancestry JOIN users ON users.id = ancestry.user_id
      ORDER BY ancestry.depth
    `);
    return {
      ancestry: result.rows.map((row) => ({
        depth: Number(row.depth),
        createdAt: new Date(String(row.created_at)),
        redeemedAt: row.redeemed_at ? new Date(String(row.redeemed_at)) : null,
        id: Number(row.id),
        username: String(row.username),
        isAncestryRoot: Boolean(row.is_ancestry_root),
      })),
    };
  });

export const moderatePlayer = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      targetUserId: z.number().int().positive(),
      reportId: z.number().int().positive().optional(),
      flagId: z.number().int().positive().optional(),
      action: z.enum(["resolve", "dismiss", "suspend", "restore"]),
      reason: z.string().trim().min(3).max(1_000),
    }),
  )
  .handler(async ({ context, data }) => {
    const { user: actor } = await requireModerator(context.user);
    if (actor.id === data.targetUserId && data.action === "suspend") {
      throw new Error("You cannot suspend yourself");
    }
    await db.transaction(async (tx) => {
      const now = new Date();
      if (data.reportId) {
        await tx
          .update(playerReports)
          .set({
            status: data.action === "dismiss" ? "dismissed" : "resolved",
            resolvedAt: now,
            resolvedByUserId: actor.id,
          })
          .where(
            and(
              eq(playerReports.id, data.reportId),
              eq(playerReports.reportedUserId, data.targetUserId),
            ),
          );
      }
      if (data.flagId) {
        await tx
          .update(moderationFlags)
          .set({
            status: "resolved",
            resolvedAt: now,
            resolvedByUserId: actor.id,
          })
          .where(
            and(
              eq(moderationFlags.id, data.flagId),
              eq(moderationFlags.userId, data.targetUserId),
            ),
          );
      }
      if (data.action === "suspend" || data.action === "restore") {
        await tx
          .update(users)
          .set({ isActive: data.action === "restore" })
          .where(eq(users.id, data.targetUserId));
      }
      await tx.insert(moderationAuditLog).values({
        actorUserId: actor.id,
        targetUserId: data.targetUserId,
        reportId: data.reportId,
        flagId: data.flagId,
        action: data.action,
        reason: data.reason,
      });
    });
    return { success: true };
  });

export const setModerationRole = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      userId: z.number().int().positive(),
      role: z.enum(["player", "moderator"]),
      reason: z.string().trim().min(3).max(1_000),
    }),
  )
  .handler(async ({ context, data }) => {
    const { user: actor, role } = await requireModerator(context.user);
    if (role !== "admin") throw new Error("Administrator access required");
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ moderationRole: data.role })
        .where(and(eq(users.id, data.userId), ne(users.id, actor.id)));
      await tx.insert(moderationAuditLog).values({
        actorUserId: actor.id,
        targetUserId: data.userId,
        action: "set_moderation_role",
        reason: data.reason,
        metadata: { role: data.role },
      });
    });
    return { success: true };
  });
