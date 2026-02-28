/**
 * Server-only primaries resolution logic.
 * Kept separate from primaries.ts (which contains createServerFn exports)
 * to avoid bundling `pg` / `db` into the client.
 */
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { primaryCandidates, primaryVotes } from "@/db/schema";

/**
 * Called by game-advance when Candidate→Voting transition happens.
 * Resolves each primary: the candidate with the most votes in each
 * party/coalition group becomes a presidential candidate.
 * Returns the list of auto-registered presidential candidate user IDs.
 */
export async function resolvePrimaries(): Promise<number[]> {
  const allCandidates = await db
    .select({
      id: primaryCandidates.id,
      userId: primaryCandidates.userId,
      partyId: primaryCandidates.partyId,
      coalitionId: primaryCandidates.coalitionId,
      votes: primaryCandidates.votes,
    })
    .from(primaryCandidates)
    .orderBy(desc(primaryCandidates.votes));

  if (allCandidates.length === 0) return [];

  // Group by coalition ID or party ID
  const groups = new Map<string, Array<(typeof allCandidates)[number]>>();

  for (const c of allCandidates) {
    const key = c.coalitionId
      ? `coalition:${c.coalitionId}`
      : `party:${c.partyId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const winnerUserIds: number[] = [];

  for (const [, groupCandidates] of groups) {
    const topVotes = groupCandidates[0].votes;
    const tied = groupCandidates.filter((c) => c.votes === topVotes);

    const winner =
      tied.length === 1
        ? tied[0]
        : tied[Math.floor(Math.random() * tied.length)];

    winnerUserIds.push(winner.userId);
  }

  return winnerUserIds;
}

/** Clear all primary data (called after primaries resolve or at election reset) */
export async function clearPrimaries(): Promise<void> {
  await db.delete(primaryVotes);
  await db.delete(primaryCandidates);
}
