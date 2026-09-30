import { and, eq, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  coalitionMembers,
  coalitionProposals,
  coalitionVotes,
  coalitions,
  feed,
  joinRequests,
  parties,
} from "@/db/schema";
import {
  COALITION_VOTE_DURATION_MS,
  decideTimedCoalitionVote,
} from "@/lib/organizations/governance";
import {
  lockPresidentialPrimary,
  syncPartyPrimaryMembership,
} from "@/lib/server/organizations/primary-membership";

/** Settle expired or fully voted proposals. Cron, ballots and page loads can safely race. */
export async function advanceCoalitionVotes(
  now = new Date(),
  proposalId?: number,
) {
  const cutoff = new Date(now.getTime() - COALITION_VOTE_DURATION_MS);
  const due = await db
    .select({ id: coalitionProposals.id })
    .from(coalitionProposals)
    .where(
      and(
        eq(coalitionProposals.status, "open"),
        proposalId ? eq(coalitionProposals.id, proposalId) : undefined,
        or(
          lte(coalitionProposals.createdAt, cutoff),
          sql`not exists (
            select 1 from ${coalitionMembers} as member
            where member.coalition_id = ${coalitionProposals.coalitionId}
              and not exists (
                select 1 from ${coalitionVotes} as ballot
                where ballot.proposal_id = ${coalitionProposals.id}
                  and ballot.voter_party_id = member.party_id
              )
          )`,
        ),
      ),
    )
    .orderBy(coalitionProposals.createdAt)
    .limit(100);

  for (const { id } of due) {
    await db.transaction(async (tx) => {
      await lockPresidentialPrimary(tx);
      const [proposal] = await tx
        .select()
        .from(coalitionProposals)
        .where(eq(coalitionProposals.id, id))
        .for("update");
      if (!proposal || proposal.status !== "open") return;
      const [coalition] = await tx
        .select({ archivedAt: coalitions.archivedAt })
        .from(coalitions)
        .where(eq(coalitions.id, proposal.coalitionId))
        .limit(1);

      const [memberCount] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(coalitionMembers)
        .where(eq(coalitionMembers.coalitionId, proposal.coalitionId));
      const [tally] = await tx
        .select({
          yes: sql<number>`count(distinct ${coalitionVotes.voterPartyId}) filter (where ${coalitionVotes.vote} = true)::int`,
          no: sql<number>`count(distinct ${coalitionVotes.voterPartyId}) filter (where ${coalitionVotes.vote} = false)::int`,
          voted: sql<number>`count(distinct ${coalitionVotes.voterPartyId})::int`,
        })
        .from(coalitionVotes)
        .innerJoin(
          coalitionMembers,
          and(
            eq(coalitionMembers.partyId, coalitionVotes.voterPartyId),
            eq(coalitionMembers.coalitionId, proposal.coalitionId),
          ),
        )
        .where(eq(coalitionVotes.proposalId, id));
      const decision = decideTimedCoalitionVote(
        memberCount?.count ?? 0,
        tally?.yes ?? 0,
        tally?.no ?? 0,
        proposal.createdAt,
        now,
        tally?.voted ?? 0,
      );
      if (decision === "open") return;
      // A pending or tied proposal fails when its voting window closes.
      let approved =
        Boolean(coalition && !coalition.archivedAt) && decision === "approved";

      if (
        approved &&
        proposal.proposalType === "join_request" &&
        proposal.targetId
      ) {
        const [request] = await tx
          .select({ id: joinRequests.id })
          .from(joinRequests)
          .where(
            and(
              eq(joinRequests.partyId, proposal.targetId),
              eq(joinRequests.coalitionId, proposal.coalitionId),
              eq(joinRequests.status, "Pending"),
            ),
          )
          .limit(1);
        await tx.execute(
          sql`select pg_advisory_xact_lock(${proposal.targetId})`,
        );
        const [alreadyIn] = await tx
          .select({ coalitionId: coalitionMembers.coalitionId })
          .from(coalitionMembers)
          .where(eq(coalitionMembers.partyId, proposal.targetId))
          .limit(1);
        const [joiningParty] = await tx
          .select({ archivedAt: parties.archivedAt })
          .from(parties)
          .where(eq(parties.id, proposal.targetId))
          .limit(1);
        if (!request || alreadyIn || !joiningParty || joiningParty.archivedAt) {
          approved = false;
        } else {
          await tx.insert(coalitionMembers).values({
            coalitionId: proposal.coalitionId,
            partyId: proposal.targetId,
          });
          await syncPartyPrimaryMembership(
            tx,
            proposal.targetId,
            proposal.coalitionId,
          );
          await tx
            .update(joinRequests)
            .set({ status: "Accepted" })
            .where(eq(joinRequests.id, request.id));
          await tx
            .update(joinRequests)
            .set({ status: "Declined" })
            .where(
              and(
                eq(joinRequests.partyId, proposal.targetId),
                eq(joinRequests.status, "Pending"),
                sql`${joinRequests.id} != ${request.id}`,
              ),
            );
        }
      } else if (approved && proposal.proposalType === "edit") {
        const p = proposal.payload;
        if (p && typeof p.name === "string" && typeof p.color === "string") {
          await tx
            .update(coalitions)
            .set({
              name: p.name,
              color: p.color,
              bio: typeof p.bio === "string" ? p.bio : null,
              logo: typeof p.logo === "string" ? p.logo : null,
              discord: typeof p.discord === "string" ? p.discord : null,
            })
            .where(eq(coalitions.id, proposal.coalitionId));
        } else {
          approved = false;
        }
      } else if (proposal.proposalType === "leave") {
        // Legacy departure proposals cannot remove a party after direct departure is enabled.
        approved = false;
      }

      if (
        !approved &&
        proposal.proposalType === "join_request" &&
        proposal.targetId
      ) {
        await tx
          .update(joinRequests)
          .set({ status: "Declined" })
          .where(
            and(
              eq(joinRequests.partyId, proposal.targetId),
              eq(joinRequests.coalitionId, proposal.coalitionId),
              eq(joinRequests.status, "Pending"),
            ),
          );
      }
      await tx
        .update(coalitionProposals)
        .set({
          status: approved ? "approved" : "rejected",
          resolvedAt: now,
        })
        .where(eq(coalitionProposals.id, id));
      await tx.insert(feed).values({
        userId: proposal.proposerUserId,
        content: `coalition #${proposal.coalitionId} proposal #${id} ${approved ? "approved" : "rejected"} after voting closed`,
      });
    });
  }
  return due.length;
}
