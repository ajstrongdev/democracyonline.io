import { and, eq, gt, or, sql } from "drizzle-orm";
import { billPartyWhips, bills } from "@/db/schema";

export type PartyLeader = {
  id: number;
  partyId: number | null;
  partyLeaderId: number | null;
  partyChiefWhipId: number | null;
  partyArchivedAt: Date | null;
  active: boolean | null;
};

export function canIssuePartyGuidance(player: PartyLeader) {
  return Boolean(
    player.active &&
    player.partyId &&
    player.partyChiefWhipId === player.id &&
    player.partyArchivedAt === null,
  );
}

export function pendingBillGuidanceCondition(partyId: number) {
  return and(
    or(
      and(eq(bills.status, "Voting"), gt(bills.stageEndsAt, new Date())),
      and(eq(bills.status, "Committee"), gt(bills.stageEndsAt, new Date())),
      and(eq(bills.status, "Queued"), eq(bills.stage, "Committee")),
    ),
    sql`not exists (select 1 from ${billPartyWhips} where ${billPartyWhips.billId} = ${bills.id} and ${billPartyWhips.partyId} = ${partyId})`,
  );
}

export function canGuideBill(
  bill: {
    status: string;
    stage: string;
    stageEndsAt: Date | null;
  },
  now = new Date(),
) {
  return (
    (bill.status === "Voting" &&
      !!bill.stageEndsAt &&
      bill.stageEndsAt > now) ||
    (bill.status === "Committee" &&
      !!bill.stageEndsAt &&
      bill.stageEndsAt > now) ||
    (bill.status === "Queued" && bill.stage === "Committee")
  );
}
