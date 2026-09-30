import { and, eq, isNotNull } from "drizzle-orm";
import type { Transaction } from "@/lib/server/organizations/organization-lifecycle";
import { billPartyWhips, feed, parties, users } from "@/db/schema";
import { breaksEnforcedWhip } from "@/lib/bills/vote-rules";

/** Called when a chamber closes. Only final contrary votes eject; abstention never does. */
export async function applyPartyWhipToVote(
  tx: Transaction,
  billId: number,
  userId: number,
  voteYes: boolean,
) {
  const [member] = await tx
    .select({ partyId: users.partyId })
    .from(users)
    .where(eq(users.id, userId))
    .for("update");
  if (!member?.partyId) return;
  const [whip] = await tx
    .select({ position: billPartyWhips.position, partyName: parties.name })
    .from(billPartyWhips)
    .innerJoin(parties, eq(parties.id, billPartyWhips.partyId))
    .where(
      and(
        eq(billPartyWhips.billId, billId),
        eq(billPartyWhips.partyId, member.partyId),
        isNotNull(billPartyWhips.enforcedAt),
      ),
    )
    .limit(1);
  if (!whip || !breaksEnforcedWhip(whip.position, voteYes)) return;
  await tx
    .update(users)
    .set({ partyId: null })
    .where(and(eq(users.id, userId), eq(users.partyId, member.partyId)));
  await tx
    .update(parties)
    .set({ chiefWhipId: null })
    .where(
      and(eq(parties.id, member.partyId), eq(parties.chiefWhipId, userId)),
    );
  await tx
    .update(parties)
    .set({ socialMediaOfficerId: null })
    .where(
      and(
        eq(parties.id, member.partyId),
        eq(parties.socialMediaOfficerId, userId),
      ),
    );
  await tx
    .update(parties)
    .set({ leaderId: null })
    .where(and(eq(parties.id, member.partyId), eq(parties.leaderId, userId)));
  await tx.insert(feed).values({
    userId,
    content: `was ejected from ${whip.partyName} for voting against an enforced whip on bill #${billId}`,
  });
}
