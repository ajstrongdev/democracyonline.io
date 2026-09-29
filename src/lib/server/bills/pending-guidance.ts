import type { PartyLeader } from "@/lib/bills/pending-guidance";
import { db } from "@/db";
import { bills } from "@/db/schema";
import {
  canIssuePartyGuidance,
  pendingBillGuidanceCondition,
} from "@/lib/bills/pending-guidance";

export async function getPendingBillGuidance(player: PartyLeader) {
  if (!canIssuePartyGuidance(player) || player.partyId === null) return [];
  return db
    .select({
      id: bills.id,
      title: bills.title,
      stage: bills.stage,
      stageEndsAt: bills.stageEndsAt,
    })
    .from(bills)
    .where(pendingBillGuidanceCondition(player.partyId))
    .orderBy(bills.createdAt);
}
