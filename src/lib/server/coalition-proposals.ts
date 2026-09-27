import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { leaveCoalitionMembership } from "./organization-lifecycle";
import {
  coalitionMembers,
  coalitionProposals,
  coalitionVotes,
  coalitions,
  feed,
  joinRequests,
  parties,
  users,
} from "@/db/schema";
import { db } from "@/db";
import { decideCoalitionVote } from "@/lib/organizations/governance";
import { requireAuthMiddleware } from "@/middleware";

async function resolveUser(email: string) {
  const [user] = await db
    .select({ id: users.id, partyId: users.partyId })
    .from(users)
    .where(eq(sql`lower(${users.email})`, sql`lower(${email})`))
    .limit(1);
  return user ?? null;
}

async function isPartyLeader(userId: number, partyId: number) {
  const [party] = await db
    .select({ leaderId: parties.leaderId })
    .from(parties)
    .where(eq(parties.id, partyId))
    .limit(1);
  return party?.leaderId === userId;
}

async function isPartyInCoalition(partyId: number, coalitionId: number) {
  const [row] = await db
    .select({ coalitionId: coalitionMembers.coalitionId })
    .from(coalitionMembers)
    .where(
      and(
        eq(coalitionMembers.partyId, partyId),
        eq(coalitionMembers.coalitionId, coalitionId),
      ),
    )
    .limit(1);
  return !!row;
}

async function isElectionOrPrimaryActive(): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM elections
    WHERE status IN ('CANDIDACY', 'VOTING', 'ELECTION_NIGHT') LIMIT 1
  `);
  return result.rows.length > 0;
}

type ProposalRow = {
  id: number;
  coalitionId: number;
  proposalType: string;
  targetId: number | null;
  payload: Record<string, string | number | boolean | null> | null;
  status: string;
  votesFor: number;
  votesAgainst: number;
  createdAt: Date;
  resolvedAt: Date | null;
  proposerUserId: number;
  proposerPartyId: number;
  proposerUsername: string;
  proposerPartyName: string;
  proposerPartyColor: string;
};

const coalitionEditSchema = z.object({
  name: z.string().trim().min(1).max(255),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  bio: z.string().max(1000),
  logo: z.string().max(255).nullable(),
});

export const getCoalitionProposals = createServerFn()
  .inputValidator(z.object({ coalitionId: z.number().int().positive() }))
  .handler(async ({ data }): Promise<Array<ProposalRow>> => {
    const rows = await db
      .select({
        id: coalitionProposals.id,
        coalitionId: coalitionProposals.coalitionId,
        proposalType: coalitionProposals.proposalType,
        targetId: coalitionProposals.targetId,
        payload: coalitionProposals.payload,
        status: coalitionProposals.status,
        votesFor: coalitionProposals.votesFor,
        votesAgainst: coalitionProposals.votesAgainst,
        createdAt: coalitionProposals.createdAt,
        resolvedAt: coalitionProposals.resolvedAt,
        proposerUserId: coalitionProposals.proposerUserId,
        proposerPartyId: coalitionProposals.proposerPartyId,
        proposerUsername: users.username,
        proposerPartyName: parties.name,
        proposerPartyColor: parties.color,
      })
      .from(coalitionProposals)
      .innerJoin(users, eq(users.id, coalitionProposals.proposerUserId))
      .innerJoin(parties, eq(parties.id, coalitionProposals.proposerPartyId))
      .where(eq(coalitionProposals.coalitionId, data.coalitionId))
      .orderBy(sql`${coalitionProposals.createdAt} desc`);

    return rows.map((r) => ({
      ...r,
      payload:
        (r.payload as Record<string, string | number | boolean | null>) ?? null,
    }));
  });

export const getCoalitionProposalVotes = createServerFn()
  .inputValidator(z.object({ proposalId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    return db
      .select({
        voterUserId: coalitionVotes.voterUserId,
        voterPartyId: coalitionVotes.voterPartyId,
        vote: coalitionVotes.vote,
        createdAt: coalitionVotes.createdAt,
        voterUsername: users.username,
        voterPartyName: parties.name,
        voterPartyColor: parties.color,
      })
      .from(coalitionVotes)
      .innerJoin(users, eq(users.id, coalitionVotes.voterUserId))
      .innerJoin(parties, eq(parties.id, coalitionVotes.voterPartyId))
      .where(eq(coalitionVotes.proposalId, data.proposalId))
      .orderBy(coalitionVotes.createdAt);
  });

export const createProposal = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      coalitionId: z.number().int().positive(),
      proposalType: z.enum(["join_request", "edit", "leave"]),
      targetId: z.number().int().positive().optional(),
      payload: z
        .record(
          z.string(),
          z.union([z.string(), z.number(), z.boolean(), z.null()]),
        )
        .optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const user = await resolveUser(context.user.email);
    if (!user?.partyId) throw new Error("You must be in a party");
    if (!(await isPartyLeader(user.id, user.partyId))) {
      throw new Error("Only party leaders can propose coalition actions");
    }
    if (!(await isPartyInCoalition(user.partyId, data.coalitionId))) {
      throw new Error("Your party is not in this coalition");
    }

    if (await isElectionOrPrimaryActive()) {
      throw new Error(
        "Coalition changes are frozen during active primaries or elections",
      );
    }

    if (data.proposalType === "leave" && data.targetId !== user.partyId) {
      throw new Error("You can only propose your own party's departure");
    }
    if (data.proposalType === "join_request" && !data.targetId) {
      throw new Error("Select a party requesting to join");
    }
    if (data.proposalType === "edit") coalitionEditSchema.parse(data.payload);

    if (data.proposalType === "join_request" && data.targetId) {
      const existing = await db
        .select({ id: joinRequests.id })
        .from(joinRequests)
        .where(
          and(
            eq(joinRequests.partyId, data.targetId),
            eq(joinRequests.coalitionId, data.coalitionId),
            eq(joinRequests.status, "Pending"),
          ),
        )
        .limit(1);
      if (!existing.length)
        throw new Error("No pending join request found for this party");
    }

    const [proposal] = await db
      .insert(coalitionProposals)
      .values({
        coalitionId: data.coalitionId,
        proposerUserId: user.id,
        proposerPartyId: user.partyId,
        proposalType: data.proposalType,
        targetId: data.targetId ?? null,
        payload: data.payload ?? null,
      })
      .returning();

    await db.insert(feed).values({
      userId: user.id,
      content: `proposed to ${data.proposalType.replaceAll("_", " ")} in their coalition`,
    });

    return proposal;
  });

export const castVote = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      proposalId: z.number().int().positive(),
      vote: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const user = await resolveUser(context.user.email);
    if (!user?.partyId) throw new Error("You must be in a party");
    const partyId = user.partyId;
    if (!(await isPartyLeader(user.id, user.partyId))) {
      throw new Error("Only party leaders can vote on coalition proposals");
    }

    await db.transaction(async (tx) => {
      const [proposal] = await tx
        .select()
        .from(coalitionProposals)
        .where(eq(coalitionProposals.id, data.proposalId))
        .for("update");
      if (!proposal || proposal.status !== "open")
        throw new Error("This proposal is no longer open");
      const [leader] = await tx
        .select({ leaderId: parties.leaderId, partyId: users.partyId })
        .from(users)
        .innerJoin(parties, eq(parties.id, users.partyId))
        .where(eq(users.id, user.id))
        .limit(1);
      if (leader?.leaderId !== user.id || leader.partyId !== partyId)
        throw new Error("Only current party leaders can vote");
      const [membership] = await tx
        .select({ partyId: coalitionMembers.partyId })
        .from(coalitionMembers)
        .where(
          and(
            eq(coalitionMembers.partyId, partyId),
            eq(coalitionMembers.coalitionId, proposal.coalitionId),
          ),
        )
        .limit(1);
      if (!membership) throw new Error("Your party is not in this coalition");
      const [existingVote] = await tx
        .select({ voterPartyId: coalitionVotes.voterPartyId })
        .from(coalitionVotes)
        .where(
          and(
            eq(coalitionVotes.proposalId, data.proposalId),
            eq(coalitionVotes.voterPartyId, partyId),
          ),
        )
        .limit(1);
      if (existingVote)
        throw new Error("Your party has already voted on this proposal");
      await tx.insert(coalitionVotes).values({
        proposalId: data.proposalId,
        voterUserId: user.id,
        voterPartyId: partyId,
        vote: data.vote,
      });
      const field = data.vote ? "votesFor" : "votesAgainst";
      await tx
        .update(coalitionProposals)
        .set({
          [field]: sql`${coalitionProposals[field]} + 1`,
        })
        .where(eq(coalitionProposals.id, data.proposalId));
      await tx.insert(feed).values({
        userId: user.id,
        content: `${data.vote ? "voted for" : "voted against"} a coalition proposal`,
      });
    });

    return { success: true };
  });

export const resolveProposal = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(z.object({ proposalId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const user = await resolveUser(context.user.email);
    if (!user?.partyId)
      throw new Error("Only member party leaders can resolve proposals");
    const partyId = user.partyId;
    return db.transaction(async (tx) => {
      const [proposal] = await tx
        .select()
        .from(coalitionProposals)
        .where(eq(coalitionProposals.id, data.proposalId))
        .for("update");
      if (!proposal) throw new Error("Proposal not found");
      if (proposal.status !== "open") throw new Error("Already resolved");

      const [leader] = await tx
        .select({ leaderId: parties.leaderId, partyId: users.partyId })
        .from(users)
        .innerJoin(parties, eq(parties.id, users.partyId))
        .where(eq(users.id, user.id))
        .limit(1);
      const [membership] = await tx
        .select({ partyId: coalitionMembers.partyId })
        .from(coalitionMembers)
        .where(
          and(
            eq(coalitionMembers.coalitionId, proposal.coalitionId),
            eq(coalitionMembers.partyId, partyId),
          ),
        )
        .limit(1);
      if (
        leader?.leaderId !== user.id ||
        leader.partyId !== partyId ||
        !membership
      )
        throw new Error(
          "Only current member party leaders can resolve proposals",
        );
      if (await isElectionOrPrimaryActive())
        throw new Error("Coalition changes are frozen during active elections");

      const [memberCount] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(coalitionMembers)
        .where(eq(coalitionMembers.coalitionId, proposal.coalitionId));
      const totalMembers = memberCount?.count ?? 0;
      const [tally] = await tx
        .select({
          yes: sql<number>`count(distinct ${coalitionVotes.voterPartyId}) filter (where ${coalitionVotes.vote} = true)::int`,
          no: sql<number>`count(distinct ${coalitionVotes.voterPartyId}) filter (where ${coalitionVotes.vote} = false)::int`,
        })
        .from(coalitionVotes)
        .innerJoin(
          coalitionMembers,
          and(
            eq(coalitionMembers.partyId, coalitionVotes.voterPartyId),
            eq(coalitionMembers.coalitionId, proposal.coalitionId),
          ),
        )
        .where(eq(coalitionVotes.proposalId, proposal.id));
      const yes = tally?.yes ?? 0;
      const no = tally?.no ?? 0;
      const decision = decideCoalitionVote(totalMembers, yes, no);
      if (decision === "pending")
        throw new Error("The coalition vote is still in progress");
      const approved = decision === "approved";

      await tx
        .update(coalitionProposals)
        .set({
          status: approved ? "approved" : "rejected",
          resolvedAt: new Date(),
        })
        .where(eq(coalitionProposals.id, proposal.id));

      if (
        approved &&
        proposal.proposalType === "join_request" &&
        proposal.targetId
      ) {
        const [request] = await tx
          .select()
          .from(joinRequests)
          .where(
            and(
              eq(joinRequests.partyId, proposal.targetId),
              eq(joinRequests.coalitionId, proposal.coalitionId),
              eq(joinRequests.status, "Pending"),
            ),
          )
          .limit(1);
        if (!request) throw new Error("The join request is no longer pending");
        await tx.execute(
          sql`select pg_advisory_xact_lock(${proposal.targetId})`,
        );
        const [alreadyIn] = await tx
          .select({ coalitionId: coalitionMembers.coalitionId })
          .from(coalitionMembers)
          .where(eq(coalitionMembers.partyId, proposal.targetId))
          .limit(1);
        if (alreadyIn)
          throw new Error("The requested party already joined a coalition");
        await tx.insert(coalitionMembers).values({
          coalitionId: proposal.coalitionId,
          partyId: proposal.targetId,
        });
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

      if (approved && proposal.proposalType === "leave" && proposal.targetId) {
        await leaveCoalitionMembership(
          tx,
          proposal.coalitionId,
          proposal.targetId,
          proposal.proposerUserId,
        );
      }

      if (approved && proposal.proposalType === "edit") {
        const p = coalitionEditSchema.parse(proposal.payload);
        await tx
          .update(coalitions)
          .set({
            name: p.name,
            color: p.color,
            bio: p.bio,
            logo: p.logo,
          })
          .where(eq(coalitions.id, proposal.coalitionId));
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

      await tx.insert(feed).values({
        userId: proposal.proposerUserId,
        content: approved
          ? `Proposal to ${proposal.proposalType} coalition was approved`
          : `Proposal to ${proposal.proposalType} coalition was rejected`,
      });

      return { approved };
    });
  });
