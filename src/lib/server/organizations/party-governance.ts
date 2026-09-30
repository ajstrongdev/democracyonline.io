import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  feed,
  parties,
  partyJoinRequests,
  partyLeadershipBids,
  partyLeadershipEligible,
  partyLeadershipSupport,
  pressureGroupMembers,
  pressureGroups,
  users,
} from "@/db/schema";
import { userEmailEquals } from "@/lib/server/auth/user-email";
import { archivePartyIfEmpty } from "@/lib/server/organizations/organization-lifecycle";
import { authMiddleware, requireAuthMiddleware } from "@/middleware";
import {
  leadershipBidHasPassed,
  leadershipBidThreshold,
} from "@/lib/organizations/leadership-bid";

const partyInput = z.object({ partyId: z.number().int().positive() });

export const getPartyGovernance = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(partyInput)
  .handler(async ({ data, context }) => {
    const [actor] = context.user?.email
      ? await db
          .select({ id: users.id, partyId: users.partyId })
          .from(users)
          .where(userEmailEquals(context.user.email))
      : [];
    const [party] = await db
      .select({ leaderId: parties.leaderId })
      .from(parties)
      .where(eq(parties.id, data.partyId));
    const [ownRequest] = actor
      ? await db
          .select({ id: partyJoinRequests.id })
          .from(partyJoinRequests)
          .where(
            and(
              eq(partyJoinRequests.partyId, data.partyId),
              eq(partyJoinRequests.userId, actor.id),
              eq(partyJoinRequests.status, "pending"),
            ),
          )
      : [];
    const requests =
      actor?.id === party?.leaderId
        ? await db
            .select({
              id: partyJoinRequests.id,
              userId: users.id,
              username: users.username,
              photoUrl: users.photoUrl,
            })
            .from(partyJoinRequests)
            .innerJoin(users, eq(users.id, partyJoinRequests.userId))
            .where(
              and(
                eq(partyJoinRequests.partyId, data.partyId),
                eq(partyJoinRequests.status, "pending"),
              ),
            )
        : [];
    const [bid] = await db
      .select({
        id: partyLeadershipBids.id,
        candidateId: partyLeadershipBids.candidateId,
        candidate: users.username,
        threshold: partyLeadershipBids.threshold,
      })
      .from(partyLeadershipBids)
      .innerJoin(users, eq(users.id, partyLeadershipBids.candidateId))
      .where(
        and(
          eq(partyLeadershipBids.partyId, data.partyId),
          eq(partyLeadershipBids.status, "open"),
        ),
      );
    const [eligible] =
      bid && actor
        ? await db
            .select({ userId: partyLeadershipEligible.userId })
            .from(partyLeadershipEligible)
            .where(
              and(
                eq(partyLeadershipEligible.bidId, bid.id),
                eq(partyLeadershipEligible.userId, actor.id),
              ),
            )
        : [];
    const support = bid
      ? await db
          .select({ userId: partyLeadershipSupport.userId })
          .from(partyLeadershipSupport)
          .innerJoin(users, eq(users.id, partyLeadershipSupport.userId))
          .where(
            and(
              eq(partyLeadershipSupport.bidId, bid.id),
              eq(users.partyId, data.partyId),
            ),
          )
      : [];
    const [candidate] = bid
      ? await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(eq(users.id, bid.candidateId), eq(users.partyId, data.partyId)),
          )
      : [];
    return {
      ownRequest: Boolean(ownRequest),
      requests,
      bid:
        bid && candidate
          ? {
              ...bid,
              supportCount: support.length,
              hasSupported: support.some((vote) => vote.userId === actor?.id),
              canSupport: Boolean(eligible),
            }
          : null,
    };
  });

export const requestPartyMembership = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(partyInput)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    return db.transaction(async (tx) => {
      const [actor] = await tx
        .select({
          id: users.id,
          partyId: users.partyId,
          active: users.isActive,
        })
        .from(users)
        .where(userEmailEquals(context.user!.email!));
      const [party] = await tx
        .select({ name: parties.name })
        .from(parties)
        .where(and(eq(parties.id, data.partyId), isNull(parties.archivedAt)));
      if (!party) throw new Error("Party not found");
      if (!actor?.active || actor.partyId === data.partyId)
        throw new Error(
          "You must be an active nonmember to request membership",
        );
      await tx
        .insert(partyJoinRequests)
        .values({ partyId: data.partyId, userId: actor.id });
      await tx.insert(feed).values({
        userId: actor.id,
        content: `requested to join ${party.name}`,
      });
      return true;
    });
  });

export const decidePartyMembership = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({ requestId: z.number().int().positive(), approve: z.boolean() }),
  )
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    return db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(partyJoinRequests)
        .where(eq(partyJoinRequests.id, data.requestId));
      if (!request) throw new Error("Request not found");
      // Lock the target party before changing membership, including group transfers.
      const [party] = await tx
        .select({
          id: parties.id,
          name: parties.name,
          leaderId: parties.leaderId,
          archivedAt: parties.archivedAt,
        })
        .from(parties)
        .where(eq(parties.id, request.partyId))
        .for("update");
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(userEmailEquals(context.user!.email!));
      if (!party || party.archivedAt || actor?.id !== party.leaderId)
        throw new Error("Only the current Party Leader can decide requests");
      const [pending] = await tx
        .select()
        .from(partyJoinRequests)
        .where(
          and(
            eq(partyJoinRequests.id, data.requestId),
            eq(partyJoinRequests.status, "pending"),
          ),
        )
        .for("update");
      if (!pending) throw new Error("This request has already been handled");
      if (data.approve) {
        const [groupMember] = await tx
          .select({ groupId: pressureGroupMembers.groupId })
          .from(pressureGroupMembers)
          .where(eq(pressureGroupMembers.userId, request.userId));
        const [group] = groupMember
          ? await tx
              .select({ founderId: pressureGroups.founderId })
              .from(pressureGroups)
              .where(eq(pressureGroups.id, groupMember.groupId))
              .for("update")
          : [];
        const [member] = await tx
          .select({
            id: users.id,
            partyId: users.partyId,
            active: users.isActive,
            username: users.username,
          })
          .from(users)
          .where(eq(users.id, request.userId))
          .for("update");
        if (!member?.active || member.partyId === party.id)
          throw new Error("Applicant is no longer eligible");
        if (groupMember) {
          if (group?.founderId === member.id)
            await tx
              .delete(pressureGroups)
              .where(eq(pressureGroups.id, groupMember.groupId));
          else
            await tx
              .delete(pressureGroupMembers)
              .where(eq(pressureGroupMembers.userId, member.id));
        }
        await tx
          .update(users)
          .set({ partyId: party.id })
          .where(eq(users.id, member.id));
        if (member.partyId) {
          await tx
            .update(parties)
            .set({ chiefWhipId: null })
            .where(
              and(
                eq(parties.id, member.partyId),
                eq(parties.chiefWhipId, member.id),
              ),
            );
          await tx
            .update(parties)
            .set({ socialMediaOfficerId: null })
            .where(
              and(
                eq(parties.id, member.partyId),
                eq(parties.socialMediaOfficerId, member.id),
              ),
            );
          const archived = await archivePartyIfEmpty(
            tx,
            member.partyId,
            member.id,
          );
          if (!archived)
            await tx
              .update(parties)
              .set({ leaderId: null })
              .where(
                and(
                  eq(parties.id, member.partyId),
                  eq(parties.leaderId, member.id),
                ),
              );
        }
        await tx.insert(feed).values({
          userId: member.id,
          content: `joined ${party.name} after their membership request was approved`,
        });
      }
      await tx
        .update(partyJoinRequests)
        .set({ status: data.approve ? "approved" : "declined" })
        .where(eq(partyJoinRequests.id, request.id));
      return true;
    });
  });

export const startLeadershipBid = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(partyInput)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    return db.transaction(async (tx) => {
      const [party] = await tx
        .select({
          id: parties.id,
          name: parties.name,
          leaderId: parties.leaderId,
        })
        .from(parties)
        .where(and(eq(parties.id, data.partyId), isNull(parties.archivedAt)))
        .for("update");
      const [actor] = await tx
        .select({ id: users.id, active: users.isActive })
        .from(users)
        .where(userEmailEquals(context.user!.email!));
      if (!party?.leaderId || !actor?.active || actor.id === party.leaderId)
        throw new Error(
          "Only another active party member can challenge the leader",
        );
      const members = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.partyId, party.id));
      const [member] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, actor.id), eq(users.partyId, party.id)));
      if (!member) throw new Error("You are not a party member");
      const [open] = await tx
        .select({
          id: partyLeadershipBids.id,
          candidateId: partyLeadershipBids.candidateId,
        })
        .from(partyLeadershipBids)
        .where(
          and(
            eq(partyLeadershipBids.partyId, party.id),
            eq(partyLeadershipBids.status, "open"),
          ),
        );
      if (open) {
        const [stillMember] = await tx
          .select({ id: users.id })
          .from(users)
          .where(
            and(eq(users.id, open.candidateId), eq(users.partyId, party.id)),
          );
        if (stillMember)
          throw new Error("This party already has an active leadership bid");
        await tx
          .update(partyLeadershipBids)
          .set({ status: "cancelled" })
          .where(eq(partyLeadershipBids.id, open.id));
      }
      const [bid] = await tx
        .insert(partyLeadershipBids)
        .values({
          partyId: party.id,
          candidateId: actor.id,
          threshold: leadershipBidThreshold(members.length),
        })
        .returning({ id: partyLeadershipBids.id });
      await tx
        .insert(partyLeadershipEligible)
        .values(
          members.map((eligibleMember) => ({ bidId: bid.id, userId: eligibleMember.id })),
        );
      await tx
        .insert(partyLeadershipSupport)
        .values({ bidId: bid.id, userId: actor.id });
      await tx.insert(feed).values({
        userId: actor.id,
        content: `launched a leadership bid in ${party.name}`,
      });
      if (leadershipBidThreshold(members.length) === 1) {
        await tx
          .update(parties)
          .set({
            leaderId: actor.id,
            chiefWhipId: sql`case when ${parties.chiefWhipId} = ${actor.id} then null else ${parties.chiefWhipId} end`,
            socialMediaOfficerId: sql`case when ${parties.socialMediaOfficerId} = ${actor.id} then null else ${parties.socialMediaOfficerId} end`,
          })
          .where(eq(parties.id, party.id));
        await tx
          .update(partyLeadershipBids)
          .set({ status: "won" })
          .where(eq(partyLeadershipBids.id, bid.id));
        await tx.insert(feed).values({
          userId: actor.id,
          content: `became leader of ${party.name} after a successful leadership bid`,
        });
      }
      return true;
    });
  });

export const withdrawLeadershipBid = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(z.object({ bidId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    return db.transaction(async (tx) => {
      const [bid] = await tx
        .select()
        .from(partyLeadershipBids)
        .where(eq(partyLeadershipBids.id, data.bidId));
      if (!bid) throw new Error("Bid not found");
      await tx
        .select({ id: parties.id })
        .from(parties)
        .where(eq(parties.id, bid.partyId))
        .for("update");
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(userEmailEquals(context.user!.email!));
      if (actor?.id !== bid.candidateId || bid.status !== "open")
        throw new Error("Only the candidate can withdraw an open bid");
      await tx
        .update(partyLeadershipBids)
        .set({ status: "withdrawn" })
        .where(eq(partyLeadershipBids.id, bid.id));
      return true;
    });
  });

export const supportLeadershipBid = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(z.object({ bidId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    return db.transaction(async (tx) => {
      const [bidParty] = await tx
        .select({ partyId: partyLeadershipBids.partyId })
        .from(partyLeadershipBids)
        .where(eq(partyLeadershipBids.id, data.bidId));
      if (!bidParty) throw new Error("Bid not found");
      const [party] = await tx
        .select({ id: parties.id, name: parties.name })
        .from(parties)
        .where(eq(parties.id, bidParty.partyId))
        .for("update");
      const [bid] = await tx
        .select()
        .from(partyLeadershipBids)
        .where(
          and(
            eq(partyLeadershipBids.id, data.bidId),
            eq(partyLeadershipBids.status, "open"),
          ),
        );
      const [actor] = await tx
        .select({
          id: users.id,
          partyId: users.partyId,
          active: users.isActive,
        })
        .from(users)
        .where(userEmailEquals(context.user!.email!));
      if (!party || !bid || !actor?.active || actor.partyId !== party.id)
        throw new Error("Only current party members may support this bid");
      const [eligible] = await tx
        .select({ userId: partyLeadershipEligible.userId })
        .from(partyLeadershipEligible)
        .where(
          and(
            eq(partyLeadershipEligible.bidId, bid.id),
            eq(partyLeadershipEligible.userId, actor.id),
          ),
        );
      if (!eligible)
        throw new Error(
          "Only members present when the bid launched may support it",
        );
      const [candidate] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, bid.candidateId), eq(users.partyId, party.id)));
      if (!candidate) throw new Error("The candidate is no longer a member");
      await tx
        .insert(partyLeadershipSupport)
        .values({ bidId: bid.id, userId: actor.id })
        .onConflictDoNothing();
      const supporters = await tx
        .select({ id: partyLeadershipSupport.userId })
        .from(partyLeadershipSupport)
        .where(eq(partyLeadershipSupport.bidId, bid.id));
      const eligibleMembers = await tx
        .select({ id: partyLeadershipEligible.userId })
        .from(partyLeadershipEligible)
        .where(eq(partyLeadershipEligible.bidId, bid.id));
      const currentMembers = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.partyId, party.id));
      if (
        leadershipBidHasPassed(
          bid.threshold,
          eligibleMembers.map((member) => member.id),
          currentMembers.map((member) => member.id),
          supporters.map((member) => member.id),
        )
      ) {
        await tx
          .update(parties)
          .set({
            leaderId: bid.candidateId,
            chiefWhipId: sql`case when ${parties.chiefWhipId} = ${bid.candidateId} then null else ${parties.chiefWhipId} end`,
            socialMediaOfficerId: sql`case when ${parties.socialMediaOfficerId} = ${bid.candidateId} then null else ${parties.socialMediaOfficerId} end`,
          })
          .where(eq(parties.id, party.id));
        await tx
          .update(partyLeadershipBids)
          .set({ status: "won" })
          .where(eq(partyLeadershipBids.id, bid.id));
        await tx.insert(feed).values({
          userId: bid.candidateId,
          content: `became leader of ${party.name} after a successful leadership bid`,
        });
      }
      return true;
    });
  });
