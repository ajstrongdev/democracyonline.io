import { and, asc, eq, sql } from "drizzle-orm";
import type { db } from "@/db";
import { bills } from "@/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const BILL_STAGE_CAPACITY = 3;
export const BILL_QUEUE_STAGES = [
  "Committee",
  "House",
  "Senate",
  "Presidential",
] as const;
export type BillQueueStage = (typeof BILL_QUEUE_STAGES)[number];

export function availableBillStageSlots(occupied: number) {
  return Math.max(0, BILL_STAGE_CAPACITY - occupied);
}

// All writers that change stage occupancy must hold this lock before admission.
export async function lockBillStages(tx: Transaction) {
  await tx.execute(sql`select pg_advisory_xact_lock(24092026)`);
}

export async function fillBillStageQueues(
  tx: Transaction,
  now: Date,
  stageDurationMs: number,
) {
  const admitted: Array<{ id: number; stage: BillQueueStage }> = [];
  for (const stage of BILL_QUEUE_STAGES) {
    const activeStage = stage === "Committee" ? "House" : stage;
    const activeStatus = stage === "Committee" ? "Committee" : "Voting";
    const [occupied] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(bills)
      .where(and(eq(bills.stage, activeStage), eq(bills.status, activeStatus)));
    const slots = availableBillStageSlots(occupied.count);
    if (!slots) continue;

    const waiting = await tx
      .select({ id: bills.id })
      .from(bills)
      .where(and(eq(bills.stage, stage), eq(bills.status, "Queued")))
      .orderBy(asc(bills.stageStartedAt), asc(bills.id))
      .limit(slots);
    for (const bill of waiting) {
      await tx
        .update(bills)
        .set({
          stage: activeStage,
          status: activeStatus,
          stageStartedAt: now,
          stageEndsAt: new Date(now.getTime() + stageDurationMs),
        })
        .where(eq(bills.id, bill.id));
      admitted.push({ id: bill.id, stage });
    }
  }
  return admitted;
}
