import { and, eq, sql } from "drizzle-orm";
import { billPartyWhips, bills } from "@/db/schema";

export type PartyLeader = {
  id: number;
  partyId: number | null;
  partyLeaderId: number | null;
  partyArchivedAt: Date | null;
  active: boolean | null;
};

export function canIssuePartyGuidance(player: PartyLeader) {
  return Boolean(
    player.active &&
    player.partyId &&
    player.partyLeaderId === player.id &&
    player.partyArchivedAt === null,
  );
}

export function pendingBillGuidanceCondition(partyId: number) {
  return and(
    eq(bills.status, "Voting"),
    sql`not exists (select 1 from ${billPartyWhips} where ${billPartyWhips.billId} = ${bills.id} and ${billPartyWhips.partyId} = ${partyId})`,
  );
}
