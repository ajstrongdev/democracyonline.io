import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  coalitionMembers,
  coalitionProposals,
  coalitionVotes,
  coalitions,
  joinRequests,
  parties,
  partyJoinRequests,
  users,
} from "@/db/schema";
import { COALITION_VOTE_DURATION_MS } from "@/lib/organizations/governance";

export async function getPartyLeaderActions(player: {
  id: number;
  partyId: number | null;
  partyLeaderId: number | null;
  partyArchivedAt: Date | null;
  active: boolean | null;
}) {
  if (
    !player.active ||
    !player.partyId ||
    player.partyArchivedAt ||
    player.partyLeaderId !== player.id
  ) {
    return {
      membershipRequests: [],
      coalitionVotes: [],
      coalitionJoinRequests: [],
      vacantOffices: [],
    };
  }

  const partyId = player.partyId;
  const [
    membershipRequests,
    coalitionVotesPending,
    coalitionJoinRequests,
    [party],
    eligibleMembers,
  ] = await Promise.all([
    db
      .select({ id: partyJoinRequests.id })
      .from(partyJoinRequests)
      .where(
        and(
          eq(partyJoinRequests.partyId, partyId),
          eq(partyJoinRequests.status, "pending"),
        ),
      )
      .orderBy(partyJoinRequests.id),
    db
      .select({
        id: coalitionProposals.id,
        proposalType: coalitionProposals.proposalType,
        coalitionId: coalitionProposals.coalitionId,
      })
      .from(coalitionProposals)
      .innerJoin(
        coalitionMembers,
        and(
          eq(coalitionMembers.coalitionId, coalitionProposals.coalitionId),
          eq(coalitionMembers.partyId, partyId),
        ),
      )
      .innerJoin(coalitions, eq(coalitions.id, coalitionProposals.coalitionId))
      .where(
        and(
          isNull(coalitions.archivedAt),
          eq(coalitionProposals.status, "open"),
          gt(
            coalitionProposals.createdAt,
            new Date(Date.now() - COALITION_VOTE_DURATION_MS),
          ),
          sql`not exists (select 1 from ${coalitionVotes} where ${coalitionVotes.proposalId} = ${coalitionProposals.id} and ${coalitionVotes.voterPartyId} = ${partyId})`,
        ),
      )
      .orderBy(coalitionProposals.createdAt),
    db
      .select({
        id: joinRequests.id,
        coalitionId: joinRequests.coalitionId,
        partyName: parties.name,
      })
      .from(joinRequests)
      .innerJoin(parties, eq(parties.id, joinRequests.partyId))
      .innerJoin(
        coalitionMembers,
        and(
          eq(coalitionMembers.coalitionId, joinRequests.coalitionId),
          eq(coalitionMembers.partyId, partyId),
        ),
      )
      .innerJoin(coalitions, eq(coalitions.id, joinRequests.coalitionId))
      .where(
        and(
          eq(joinRequests.status, "Pending"),
          isNull(parties.archivedAt),
          isNull(coalitions.archivedAt),
          sql`not exists (select 1 from ${coalitionProposals} where ${coalitionProposals.coalitionId} = ${joinRequests.coalitionId} and ${coalitionProposals.targetId} = ${joinRequests.partyId} and ${coalitionProposals.proposalType} = 'join_request' and ${coalitionProposals.status} = 'open')`,
        ),
      )
      .orderBy(joinRequests.id),
    db
      .select({
        chiefWhipId: parties.chiefWhipId,
        socialMediaOfficerId: parties.socialMediaOfficerId,
      })
      .from(parties)
      .where(eq(parties.id, partyId))
      .limit(1),
    db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.partyId, partyId), eq(users.isActive, true))),
  ]);

  const vacantOffices = party
    ? (
        [
          {
            office: "chiefWhip",
            title: "Chief Whip",
            holderId: party.chiefWhipId,
            otherId: party.socialMediaOfficerId,
          },
          {
            office: "socialMediaOfficer",
            title: "Social Media Officer",
            holderId: party.socialMediaOfficerId,
            otherId: party.chiefWhipId,
          },
        ] as const
      ).filter(
        (role) =>
          role.holderId === null &&
          eligibleMembers.some(
            (member) => member.id !== player.id && member.id !== role.otherId,
          ),
      )
    : [];

  return {
    membershipRequests,
    coalitionVotes: coalitionVotesPending,
    coalitionJoinRequests,
    vacantOffices,
  };
}
