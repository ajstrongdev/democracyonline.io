import { createServerFn } from "@tanstack/react-start";
import { desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  billLockedPolicyEffects,
  billLockedStatEffects,
  bills,
  moderationAuditLog,
  users,
} from "@/db/schema";
import {
  getBillStageDurationMs,
  getGameSpeed,
} from "@/lib/server/scheduler/game-speed";
import { userEmailEquals } from "@/lib/server/auth/user-email";
import { isAdminEmail } from "@/lib/server/admin/admin";
import { lockCommitteeOutcome } from "@/lib/server/bills/committee";
import { recordIndicatedVotes } from "@/lib/server/bills/vote-indications";
import {
  fillBillStageQueues,
  lockBillStages,
} from "@/lib/server/bills/stage-queue";
import { authMiddleware } from "@/middleware/auth";

export const searchAdminBills = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(z.object({ query: z.string().trim().max(100) }))
  .handler(async ({ context, data }) => {
    if (!context.user?.email || !isAdminEmail(context.user.email))
      throw new Error("Unauthorized");
    const query = data.query.trim();
    const id = Number(query);
    const filter = query
      ? or(
          ilike(
            bills.title,
            `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`,
          ),
          Number.isSafeInteger(id) && id > 0 ? eq(bills.id, id) : undefined,
        )
      : undefined;
    return db
      .select({
        id: bills.id,
        title: bills.title,
        stage: bills.stage,
        status: bills.status,
        nationEffectsAppliedAt: bills.nationEffectsAppliedAt,
      })
      .from(bills)
      .where(filter)
      .orderBy(desc(bills.createdAt), desc(bills.id))
      .limit(30);
  });

export const setAdminBillStage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      billId: z.number().int().positive(),
      stage: z.enum(["Committee", "House", "Senate", "Presidential"]),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!context.user?.email || !isAdminEmail(context.user.email))
      throw new Error("Unauthorized");
    const stageDurationMs = getBillStageDurationMs(
      (await getGameSpeed()).multiplier,
    );
    return db.transaction(async (tx) => {
      // Matches the scheduler and vote writers: do not race a stage close.
      await lockBillStages(tx);
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(userEmailEquals(context.user!.email!));
      if (!actor) throw new Error("Admin player profile not found");
      const [bill] = await tx
        .select({
          id: bills.id,
          title: bills.title,
          status: bills.status,
          stage: bills.stage,
          nationEffectsAppliedAt: bills.nationEffectsAppliedAt,
        })
        .from(bills)
        .where(eq(bills.id, data.billId))
        .for("update");
      if (!bill) throw new Error("Bill not found");
      const stage = data.stage;
      if (
        (bill.status === "Committee" && stage === "Committee") ||
        (bill.status === "Voting" && bill.stage === stage) ||
        (bill.status === "Queued" && bill.stage === stage)
      )
        throw new Error("Bill is already at that stage");
      const now = new Date();
      if (data.stage === "Committee") {
        // Committee can be revisited; its outcome must be recalculated on close.
        await tx
          .delete(billLockedStatEffects)
          .where(eq(billLockedStatEffects.billId, bill.id));
        await tx
          .delete(billLockedPolicyEffects)
          .where(eq(billLockedPolicyEffects.billId, bill.id));
      } else if (bill.status === "Committee") {
        // Leaving committee normally locks its assessments and nation effects.
        await lockCommitteeOutcome(tx, bill.id, now, stageDurationMs);
      }
      await tx
        .update(bills)
        .set({
          status: "Queued",
          stage,
          stageStartedAt: now,
          stageEndsAt: null,
          ...(data.stage === "Committee"
            ? { committeeClosedAt: null, committeeParticipantCount: null }
            : {}),
        })
        .where(eq(bills.id, bill.id));
      const admitted = await fillBillStageQueues(tx, now, stageDurationMs);
      for (const opened of admitted)
        if (opened.stage !== "Committee")
          await recordIndicatedVotes(tx, opened.id, opened.stage);
      await tx.insert(moderationAuditLog).values({
        actorUserId: actor.id,
        action: "admin_bill_stage",
        reason: `Bill #${bill.id} ${bill.status}/${bill.stage} → Queued/${stage}; recorded votes retained; enacted effects ${bill.nationEffectsAppliedAt ? "retained" : "not applied"}`,
      });
      return {
        id: bill.id,
        title: bill.title,
        stage:
          stage === "Committee" &&
          admitted.some((opened) => opened.id === bill.id)
            ? "House"
            : stage,
        status: admitted.some((opened) => opened.id === bill.id)
          ? stage === "Committee"
            ? "Committee"
            : "Voting"
          : "Queued",
        nationEffectsAppliedAt: bill.nationEffectsAppliedAt,
      };
    });
  });
