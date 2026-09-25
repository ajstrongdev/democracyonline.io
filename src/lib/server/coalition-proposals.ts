import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { archiveCoalitionIfEmpty } from "./organization-lifecycle";
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
    SELECT status FROM elections LIMIT 1
  `);
  const row = result.rows[0] as { status?: string } | undefined;
  return row?.status === "CANDIDACY" || row?.status === "VOTING";
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
      payload: (r.payload as Record<string, string | number | boolean | null>) ?? null,
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
      payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
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
    if (!(await isPartyLeader(user.id, user.partyId))) {
      throw new Error("Only party leaders can vote on coalition proposals");
    }

    const [proposal] = await db
      .select({
        id: coalitionProposals.id,
        coalitionId: coalitionProposals.coalitionId,
        status: coalitionProposals.status,
        votesFor: coalitionProposals.votesFor,
        votesAgainst: coalitionProposals.votesAgainst,
      })
      .from(coalitionProposals)
      .where(eq(coalitionProposals.id, data.proposalId))
      .limit(1);
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.status !== "open")
      throw new Error("This proposal is no longer open");

    if (!(await isPartyInCoalition(user.partyId, proposal.coalitionId))) {
      throw new Error("Your party is not in this coalition");
    }

    const [existingVote] = await db
      .select({ proposalId: coalitionVotes.proposalId })
      .from(coalitionVotes)
      .where(
        and(
          eq(coalitionVotes.proposalId, data.proposalId),
          eq(coalitionVotes.voterUserId, user.id),
        ),
      )
      .limit(1);
    if (existingVote)
      throw new Error("You have already voted on this proposal");

    await db.insert(coalitionVotes).values({
      proposalId: data.proposalId,
      voterUserId: user.id,
      voterPartyId: user.partyId,
      vote: data.vote,
    });

    const field = data.vote ? "votesFor" : "votesAgainst";
    await db
      .update(coalitionProposals)
      .set({
        [field]: sql`${coalitionProposals[field]} + 1`,
      })
      .where(eq(coalitionProposals.id, data.proposalId));

    await db.insert(feed).values({
      userId: user.id,
      content: `${data.vote ? "voted for" : "voted against"} a coalition proposal`,
    });

    return { success: true };
  });

export const resolveProposal = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(z.object({ proposalId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const [proposal] = await db
      .select()
      .from(coalitionProposals)
      .where(eq(coalitionProposals.id, data.proposalId))
      .limit(1);
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.status !== "open") throw new Error("Already resolved");

    const [memberCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(coalitionMembers)
      .where(eq(coalitionMembers.coalitionId, proposal.coalitionId));
    const totalMembers = memberCount?.count ?? 0;
    const majority = Math.floor(totalMembers / 2) + 1;
    const approved = proposal.votesFor >= majority;

    await db
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
      const [request] = await db
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
      if (request) {
        await db.transaction(async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(${proposal.targetId})`,
          );
          const [alreadyIn] = await tx
            .select({ coalitionId: coalitionMembers.coalitionId })
            .from(coalitionMembers)
            .where(eq(coalitionMembers.partyId, proposal.targetId!))
            .limit(1);
          if (!alreadyIn) {
            await tx.insert(coalitionMembers).values({
              coalitionId: proposal.coalitionId,
              partyId: proposal.targetId!,
            });
          }
          await tx
            .update(joinRequests)
            .set({ status: "Accepted" })
            .where(eq(joinRequests.id, request.id));
          await tx
            .update(joinRequests)
            .set({ status: "Declined" })
            .where(
              and(
                eq(joinRequests.partyId, proposal.targetId!),
                eq(joinRequests.status, "Pending"),
                sql`${joinRequests.id} != ${request.id}`,
              ),
            );
        });
      }
    }

    if (approved && proposal.proposalType === "leave" && proposal.targetId) {
      await db.transaction(async (tx) => {
        await tx
          .delete(coalitionMembers)
          .where(
            and(
              eq(coalitionMembers.coalitionId, proposal.coalitionId),
              eq(coalitionMembers.partyId, proposal.targetId!),
            ),
          );
        await archiveCoalitionIfEmpty(
          tx,
          proposal.coalitionId,
          proposal.proposerUserId,
        );
      });
    }

    if (approved && proposal.proposalType === "edit" && proposal.payload) {
      const p = proposal.payload;
      await db
        .update(coalitions)
        .set({
          ...(typeof p.name === "string" ? { name: p.name } : {}),
          ...(typeof p.color === "string" ? { color: p.color } : {}),
          ...(typeof p.bio === "string" ? { bio: p.bio } : {}),
          ...(typeof p.logo === "string" ? { logo: p.logo } : {}),
        })
        .where(eq(coalitions.id, proposal.coalitionId));
    }

    await db.insert(feed).values({
      userId: proposal.proposerUserId,
      content: approved
        ? `Proposal to ${proposal.proposalType} coalition was approved`
        : `Proposal to ${proposal.proposalType} coalition was rejected`,
    });

    return { approved };
  });
