import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { db } from "@/db";
import {
  coalitionFormerMembers,
  coalitionMembers,
  coalitions,
  feed,
  joinRequests,
  organizationLifecycleEvents,
  parties,
  partyNotifications,
  users,
} from "@/db/schema";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function rememberFormerCoalitionMember(
  tx: Transaction,
  membership: {
    coalitionId: number;
    partyId: number;
    joinDate: Date | null;
  },
) {
  await tx
    .insert(coalitionFormerMembers)
    .values({
      coalitionId: membership.coalitionId,
      partyId: membership.partyId,
      firstJoinedAt: membership.joinDate,
      lastLeftAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        coalitionFormerMembers.coalitionId,
        coalitionFormerMembers.partyId,
      ],
      set: { lastLeftAt: new Date() },
    });
}

export async function archiveCoalitionIfEmpty(
  tx: Transaction,
  coalitionId: number,
  actorUserId: number | null = null,
) {
  await tx.execute(sql`select pg_advisory_xact_lock(${-coalitionId})`);
  const [coalition] = await tx
    .select({
      id: coalitions.id,
      name: coalitions.name,
      archivedAt: coalitions.archivedAt,
    })
    .from(coalitions)
    .where(eq(coalitions.id, coalitionId))
    .limit(1);
  if (!coalition || coalition.archivedAt) return false;

  const [remaining] = await tx
    .select({ partyId: coalitionMembers.partyId })
    .from(coalitionMembers)
    .where(eq(coalitionMembers.coalitionId, coalitionId))
    .limit(1);
  if (remaining) return false;

  const [archived] = await tx
    .update(coalitions)
    .set({ archivedAt: new Date() })
    .where(and(eq(coalitions.id, coalitionId), isNull(coalitions.archivedAt)))
    .returning({ id: coalitions.id });
  if (!archived) return false;

  await tx
    .delete(joinRequests)
    .where(eq(joinRequests.coalitionId, coalitionId));
  await tx.insert(organizationLifecycleEvents).values({
    organizationType: "coalition",
    organizationId: coalition.id,
    organizationName: coalition.name,
    action: "archived",
    actorUserId,
    metadata: { reason: "last_member_left" },
  });
  await tx.insert(feed).values({
    userId: actorUserId,
    visibility: "admin",
    content: `${coalition.name} was archived after its last member party left`,
  });
  return true;
}

export async function removePartyFromCoalitions(
  tx: Transaction,
  partyId: number,
  actorUserId: number | null = null,
) {
  const memberships = await tx
    .select({
      coalitionId: coalitionMembers.coalitionId,
      partyId: coalitionMembers.partyId,
      joinDate: coalitionMembers.joinDate,
    })
    .from(coalitionMembers)
    .where(eq(coalitionMembers.partyId, partyId));

  for (const membership of memberships) {
    await rememberFormerCoalitionMember(tx, membership);
  }
  if (memberships.length) {
    await tx
      .delete(coalitionMembers)
      .where(eq(coalitionMembers.partyId, partyId));
  }
  for (const membership of memberships) {
    await archiveCoalitionIfEmpty(tx, membership.coalitionId, actorUserId);
  }
}

export async function leaveCoalitionMembership(
  tx: Transaction,
  coalitionId: number,
  partyId: number,
  actorUserId: number,
) {
  const [membership] = await tx
    .select({
      coalitionId: coalitionMembers.coalitionId,
      partyId: coalitionMembers.partyId,
      joinDate: coalitionMembers.joinDate,
    })
    .from(coalitionMembers)
    .where(
      and(
        eq(coalitionMembers.coalitionId, coalitionId),
        eq(coalitionMembers.partyId, partyId),
      ),
    )
    .limit(1);
  if (!membership) return false;

  await rememberFormerCoalitionMember(tx, membership);
  await tx
    .delete(coalitionMembers)
    .where(
      and(
        eq(coalitionMembers.coalitionId, coalitionId),
        eq(coalitionMembers.partyId, partyId),
      ),
    );
  await archiveCoalitionIfEmpty(tx, coalitionId, actorUserId);
  return true;
}

export async function archivePartyIfEmpty(
  tx: Transaction,
  partyId: number,
  actorUserId: number | null = null,
) {
  await tx.execute(sql`select pg_advisory_xact_lock(${partyId})`);
  const [party] = await tx
    .select({
      id: parties.id,
      name: parties.name,
      leaderId: parties.leaderId,
      archivedAt: parties.archivedAt,
    })
    .from(parties)
    .where(eq(parties.id, partyId))
    .limit(1);
  if (!party || party.archivedAt) return false;

  const [remaining] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.partyId, partyId))
    .limit(1);
  if (remaining) return false;

  const [archived] = await tx
    .update(parties)
    .set({
      archivedAt: new Date(),
      formerLeaderId: party.leaderId,
      leaderId: null,
    })
    .where(and(eq(parties.id, partyId), isNull(parties.archivedAt)))
    .returning({ id: parties.id });
  if (!archived) return false;

  await removePartyFromCoalitions(tx, partyId, actorUserId);
  await tx.delete(joinRequests).where(eq(joinRequests.partyId, partyId));
  await tx
    .delete(partyNotifications)
    .where(
      sql`${partyNotifications.senderPartyId} = ${partyId} or ${partyNotifications.receiverPartyId} = ${partyId}`,
    );
  await tx.insert(organizationLifecycleEvents).values({
    organizationType: "party",
    organizationId: party.id,
    organizationName: party.name,
    action: "archived",
    actorUserId,
    metadata: { reason: "last_member_left", formerLeaderId: party.leaderId },
  });
  await tx.insert(feed).values({
    userId: actorUserId,
    visibility: "admin",
    content: `${party.name} was archived after its last member left`,
  });
  return true;
}

export async function archiveEmptyParties(
  tx: Transaction,
  partyIds?: Array<number>,
) {
  const conditions = [isNull(parties.archivedAt)];
  if (partyIds?.length) conditions.push(inArray(parties.id, partyIds));
  const candidates = await tx
    .select({ id: parties.id })
    .from(parties)
    .where(and(...conditions));

  let archived = 0;
  for (const party of candidates) {
    if (await archivePartyIfEmpty(tx, party.id)) archived += 1;
  }
  return archived;
}
