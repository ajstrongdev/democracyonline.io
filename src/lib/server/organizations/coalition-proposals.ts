import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { advanceCoalitionVotes } from "@/lib/server/organizations/coalition-vote-lifecycle";
import { coalitionVoteEndsAt } from "@/lib/organizations/governance";
import {
  coalitionMembers,
  coalitionProposals,
  coalitionVotes,
  feed,
  joinRequests,
  parties,
  users,
} from "@/db/schema";
import { db } from "@/db";
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
  discord: z
    .string()
    .url()
    .refine((url) => url.startsWith("https://"))
    .max(255)
    .nullable(),
});

export const getCoalitionProposals = createServerFn()
  .inputValidator(z.object({ coalitionId: z.number().int().positive() }))
  .handler(async ({ data }): Promise<Array<ProposalRow>> => {
    await advanceCoalitionVotes();
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
      proposalType: z.enum(["join_request", "edit"]),
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
      const [openVote] = await db
        .select({ id: coalitionProposals.id })
        .from(coalitionProposals)
        .where(
          and(
            eq(coalitionProposals.coalitionId, data.coalitionId),
            eq(coalitionProposals.proposalType, "join_request"),
            eq(coalitionProposals.targetId, data.targetId),
            eq(coalitionProposals.status, "open"),
          ),
        )
        .limit(1);
      if (openVote)
        throw new Error("This join request is already being voted on");
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
      if (coalitionVoteEndsAt(proposal.createdAt) <= new Date()) {
        throw new Error("Voting on this proposal has closed");
      }
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

    await advanceCoalitionVotes(new Date(), data.proposalId);

    return { success: true };
  });
