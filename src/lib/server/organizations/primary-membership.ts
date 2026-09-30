import { eq, sql } from "drizzle-orm";
import type { Transaction } from "@/lib/server/organizations/organization-lifecycle";
import { elections, primaryCandidates, primaryVotes, users } from "@/db/schema";

/** Serialize membership changes with ballots and the Candidate → Voting transition. */
export async function lockPresidentialPrimary(tx: Transaction) {
  await tx.execute(
    sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = 'President' FOR UPDATE`,
  );
}

/** Keep candidates in their current group and remove ballots invalidated by a split. */
export async function syncPartyPrimaryMembership(
  tx: Transaction,
  partyId: number,
  coalitionId: number | null,
) {
  await tx
    .update(primaryCandidates)
    .set({ coalitionId })
    .where(eq(primaryCandidates.partyId, partyId));

  if (coalitionId === null) {
    // A departing party's votes for other parties, and other parties' votes
    // for its candidates, can no longer count in either primary.
    await tx.execute(sql`
      DELETE FROM ${primaryVotes} AS ballot
      USING ${users} AS voter, ${primaryCandidates} AS nominee
      WHERE ballot.user_id = voter.id AND ballot.candidate_id = nominee.id
        AND (
          (voter.party_id = ${partyId} AND nominee.party_id <> ${partyId})
          OR (nominee.party_id = ${partyId} AND voter.party_id <> ${partyId})
        )
    `);
  }

  await tx.execute(sql`
    UPDATE ${primaryCandidates} AS nominee
    SET votes = (SELECT count(*)::int FROM ${primaryVotes} AS ballot WHERE ballot.candidate_id = nominee.id)
  `);
}
