import { createServerFn } from "@tanstack/react-start";
import { and, eq, getTableColumns, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  feed,
  organizationLifecycleEvents,
  parties,
  partyFormationInvites,
  pressureGroupMembers,
  users,
  wikiArticleRevisions,
  wikiArticles,
} from "@/db/schema";
import { db } from "@/db";
import {
  CreatePartySchema,
  UpdatePartySchema,
} from "@/lib/schemas/party-schema";
import { userEmailEquals } from "@/lib/server/auth/user-email";
import { authMiddleware, requireAuthMiddleware } from "@/middleware";
import { isAdminEmail } from "@/lib/server/admin/admin";
import { canReviveParty } from "@/lib/organizations/lifecycle";
import { archivePartyIfEmpty } from "@/lib/server/organizations/organization-lifecycle";

// Data fetching
export const partyPageData = createServerFn()
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const partyInfo = await getParties();
    const isInParty = await checkUserInParty({ data: { email: data.email } });
    return { partyInfo, isInParty };
  });

export const getParties = createServerFn().handler(async () => {
  const rows = await db
    .select({
      ...getTableColumns(parties),
      memberCount: sql<number>`count(${users.id})`.as("memberCount"),
    })
    .from(parties)
    .leftJoin(users, eq(users.partyId, parties.id))
    .where(isNull(parties.archivedAt))
    .groupBy(parties.id)
    .orderBy(sql`count(${users.id}) desc`);
  return rows;
});

export const checkUserInParty = createServerFn()
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const [user] = await db
      .select({ partyId: users.partyId })
      .from(users)
      .where(userEmailEquals(data.email))
      .limit(1);

    return user?.partyId !== null && user?.partyId !== undefined;
  });

export const checkUserInSpecificParty = createServerFn()
  .inputValidator((data: { userId: number; partyId: number }) => data)
  .handler(async ({ data }) => {
    const [user] = await db
      .select({ partyId: users.partyId })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);
    return user?.partyId === data.partyId;
  });

export const checkIfUserIsPartyLeader = createServerFn()
  .inputValidator((data: { userId: number; partyId: number }) => data)
  .handler(async ({ data }) => {
    const [party] = await db
      .select({ leaderId: parties.leaderId })
      .from(parties)
      .where(and(eq(parties.id, data.partyId), isNull(parties.archivedAt)))
      .limit(1);
    return party?.leaderId === data.userId;
  });

export const getMembershipStatus = createServerFn()
  .inputValidator((data: { userId: number; partyId: number }) => data)
  .handler(async ({ data }) => {
    const isInParty = await checkUserInSpecificParty({
      data: { userId: data.userId, partyId: data.partyId },
    });
    const isLeader = await checkIfUserIsPartyLeader({
      data: { userId: data.userId, partyId: data.partyId },
    });
    return { isInParty, isLeader };
  });

export const getPartyMembers = createServerFn()
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data }) => {
    const { email, isAncestryRoot, moderationRole, ...userColumns } =
      getTableColumns(users);
    const members = await db
      .select(userColumns)
      .from(users)
      .where(eq(users.partyId, data.partyId));
    return members;
  });

export const getPartyById = createServerFn()
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data }) => {
    const [party] = await db
      .select()
      .from(parties)
      .where(eq(parties.id, data.partyId))
      .limit(1);
    return party || null;
  });

// Mutations
export const createParty = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator(CreatePartySchema)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const [creator] = await db
      .select({
        id: users.id,
        username: users.username,
        partyId: users.partyId,
        active: users.isActive,
      })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);
    if (!creator) throw new Error("Player account not found");
    if (!creator.active)
      throw new Error("Only active players can form parties");
    if (creator.partyId) throw new Error("Leave your current party first");

    const { party, platform, cofounders } = data;
    if (
      new Set(cofounders.map((name) => name.toLowerCase())).size !== 2 ||
      cofounders.some(
        (name) => name.toLowerCase() === creator.username.toLowerCase(),
      )
    )
      throw new Error("Choose two distinct players other than yourself");
    return db.transaction(async (tx) => {
      const [member] = await tx
        .select({ partyId: users.partyId })
        .from(users)
        .where(eq(users.id, creator.id))
        .for("update");
      if (!member || member.partyId)
        throw new Error("Leave your current party first");
      const [formingGroup] = await tx
        .select({ groupId: pressureGroupMembers.groupId })
        .from(pressureGroupMembers)
        .where(eq(pressureGroupMembers.userId, creator.id))
        .limit(1);
      if (formingGroup)
        throw new Error(
          "Leave your pressure group before starting another party",
        );
      const [nameTaken] = await tx
        .select({ id: parties.id })
        .from(parties)
        .where(eq(parties.name, party.name))
        .limit(1);
      if (nameTaken) throw new Error("That party name is already taken");
      const [existing] = await tx
        .select({ id: partyFormationInvites.id })
        .from(partyFormationInvites)
        .where(
          and(
            eq(partyFormationInvites.founderId, creator.id),
            inArray(partyFormationInvites.status, ["pending", "accepted"]),
          ),
        )
        .limit(1);
      if (existing)
        throw new Error("You already have a party awaiting cofounders");
      const invitees = await tx
        .select({
          id: users.id,
          username: users.username,
          partyId: users.partyId,
          active: users.isActive,
        })
        .from(users)
        .where(
          sql`lower(${users.username}) in (${cofounders[0].toLowerCase()}, ${cofounders[1].toLowerCase()})`,
        );
      if (
        invitees.length !== 2 ||
        invitees.some((invitee) => invitee.partyId || !invitee.active)
      )
        throw new Error("Both cofounders must be active independent players");
      await tx.insert(partyFormationInvites).values(
        invitees.map((invitee) => ({
          founderId: creator.id,
          inviteeId: invitee.id,
          office:
            invitee.username.toLowerCase() === cofounders[0].toLowerCase()
              ? "Chief Whip"
              : "Social Media Officer",
          name: party.name,
          details: { party, platform },
        })),
      );
      return { pending: true };
    });
  });

export const getPartyFormationInvites = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user?.email) return [];
    const [player] = await db
      .select({ id: users.id })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);
    if (!player) return [];
    return db
      .select({
        id: partyFormationInvites.id,
        name: partyFormationInvites.name,
        status: partyFormationInvites.status,
        office: partyFormationInvites.office,
        founder: users.username,
      })
      .from(partyFormationInvites)
      .innerJoin(users, eq(users.id, partyFormationInvites.founderId))
      .where(
        and(
          eq(partyFormationInvites.inviteeId, player.id),
          inArray(partyFormationInvites.status, [
            "pending",
            "accepted",
            "declined",
            "cancelled",
            "formed",
          ]),
        ),
      )
      .orderBy(sql`${partyFormationInvites.createdAt} DESC`)
      .limit(10);
  });

export const getMyPartyFormationProgress = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user?.email) return [];
    const [player] = await db
      .select({ id: users.id })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);
    if (!player) return [];
    return db
      .select({
        id: partyFormationInvites.id,
        name: partyFormationInvites.name,
        status: partyFormationInvites.status,
        office: partyFormationInvites.office,
        invitee: users.username,
      })
      .from(partyFormationInvites)
      .innerJoin(users, eq(users.id, partyFormationInvites.inviteeId))
      .where(
        and(
          eq(partyFormationInvites.founderId, player.id),
          inArray(partyFormationInvites.status, [
            "pending",
            "accepted",
            "declined",
          ]),
        ),
      )
      .orderBy(sql`${partyFormationInvites.createdAt} DESC`)
      .limit(10);
  });

export const cancelPartyFormation = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(z.object({ inviteId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    return db.transaction(async (tx) => {
      const [founder] = await tx
        .select({ id: users.id })
        .from(users)
        .where(userEmailEquals(context.user!.email!))
        .for("update");
      if (!founder) throw new Error("Player not found");
      const [invitation] = await tx
        .select({ name: partyFormationInvites.name })
        .from(partyFormationInvites)
        .where(
          and(
            eq(partyFormationInvites.id, data.inviteId),
            eq(partyFormationInvites.founderId, founder.id),
            inArray(partyFormationInvites.status, ["pending", "accepted"]),
          ),
        );
      if (!invitation) throw new Error("Formation request is no longer open");
      await tx
        .update(partyFormationInvites)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(partyFormationInvites.founderId, founder.id),
            eq(partyFormationInvites.name, invitation.name),
            inArray(partyFormationInvites.status, ["pending", "accepted"]),
          ),
        );
      return true;
    });
  });

export const respondToPartyFormation = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({ inviteId: z.number().int().positive(), accept: z.boolean() }),
  )
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
        .where(userEmailEquals(context.user!.email!))
        .limit(1);
      if (!actor?.active)
        throw new Error(
          "Only active players can respond to formation invitations",
        );
      const [invitation] = await tx
        .select()
        .from(partyFormationInvites)
        .where(
          and(
            eq(partyFormationInvites.id, data.inviteId),
            eq(partyFormationInvites.inviteeId, actor.id),
          ),
        )
        .limit(1);
      if (!invitation) throw new Error("Invitation not found");
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, invitation.founderId))
        .for("update");
      const group = await tx
        .select()
        .from(partyFormationInvites)
        .where(
          and(
            eq(partyFormationInvites.founderId, invitation.founderId),
            eq(partyFormationInvites.name, invitation.name),
            inArray(partyFormationInvites.status, ["pending", "accepted"]),
          ),
        );
      if (invitation.status !== "pending" || group.length !== 2)
        throw new Error("This invitation is no longer open");
      if (!data.accept) {
        await tx
          .update(partyFormationInvites)
          .set({ status: "declined" })
          .where(
            inArray(
              partyFormationInvites.id,
              group.map((item) => item.id),
            ),
          );
        return { formed: false };
      }
      if (actor.partyId) throw new Error("Leave your party before accepting");
      await tx
        .update(partyFormationInvites)
        .set({ status: "accepted" })
        .where(eq(partyFormationInvites.id, invitation.id));
      if (
        group.some(
          (item) => item.id !== invitation.id && item.status !== "accepted",
        )
      )
        return { formed: false };
      const ids = [
        invitation.founderId,
        ...group.map((item) => item.inviteeId),
      ].sort((a, b) => a - b);
      const members = await tx
        .select({
          id: users.id,
          partyId: users.partyId,
          username: users.username,
          active: users.isActive,
        })
        .from(users)
        .where(inArray(users.id, ids))
        .for("update");
      if (
        members.length !== 3 ||
        members.some((member) => member.partyId || !member.active)
      )
        throw new Error("All three founders must still be active independents");
      const formingMembers = await tx
        .select({ userId: pressureGroupMembers.userId })
        .from(pressureGroupMembers)
        .where(inArray(pressureGroupMembers.userId, ids));
      if (formingMembers.length)
        throw new Error(
          "Leave your pressure group before forming another party",
        );
      const details = invitation.details as {
        party: z.infer<typeof CreatePartySchema>["party"];
        platform: string;
      };
      const [newParty] = await tx
        .insert(parties)
        .values({
          ...details.party,
          leaderId: invitation.founderId,
          chiefWhipId: group.find((item) => item.office === "Chief Whip")!
            .inviteeId,
          socialMediaOfficerId: group.find(
            (item) => item.office === "Social Media Officer",
          )!.inviteeId,
        })
        .returning();
      await tx
        .update(users)
        .set({ partyId: newParty.id })
        .where(inArray(users.id, ids));
      await tx
        .update(partyFormationInvites)
        .set({ status: "formed" })
        .where(
          inArray(
            partyFormationInvites.id,
            group.map((item) => item.id),
          ),
        );
      await tx.insert(organizationLifecycleEvents).values({
        organizationType: "party",
        organizationId: newParty.id,
        organizationName: newParty.name,
        action: "created",
        actorUserId: invitation.founderId,
      });
      await tx.insert(feed).values({
        userId: invitation.founderId,
        content: `formed ${newParty.name} with two cofounders`,
      });
      if (details.platform) {
        const [article] = await tx
          .insert(wikiArticles)
          .values({ entityType: "party", entityId: String(newParty.id) })
          .returning({ id: wikiArticles.id });
        await tx.insert(wikiArticleRevisions).values({
          articleId: article.id,
          editorUserId: invitation.founderId,
          editorUsername: members.find(
            (member) => member.id === invitation.founderId,
          )!.username,
          content: details.platform,
          editSummary: "Published initial party platform",
        });
      }
      return { formed: true, partyId: newParty.id };
    });
  });

export const updateParty = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator(UpdatePartySchema)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) {
      throw new Error("Authentication required");
    }

    const [currentUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);

    if (!currentUser) {
      throw new Error("User not found");
    }

    const [party] = await db
      .select({ leaderId: parties.leaderId })
      .from(parties)
      .where(and(eq(parties.id, data.party.id), isNull(parties.archivedAt)))
      .limit(1);

    if (!party || party.leaderId !== currentUser.id) {
      throw new Error("Only the party leader can update the party");
    }

    const partyData = data.party;
    await db
      .update(parties)
      .set({
        name: partyData.name,
        bio: partyData.bio,
        color: partyData.color,
        logo: partyData.logo,
        discord: partyData.discord,
        leaning: partyData.leaning,
      })
      .where(eq(parties.id, partyData.id));
    await db.insert(feed).values({
      userId: currentUser.id,
      content: `updated the ${partyData.name} party profile`,
    });
    return true;
  });

export const appointPartyOfficer = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      partyId: z.number().int().positive(),
      office: z.enum(["chiefWhip", "socialMediaOfficer"]),
      userId: z.number().int().positive().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    return db.transaction(async (tx) => {
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(userEmailEquals(context.user!.email!))
        .limit(1);
      const [party] = await tx
        .select({
          leaderId: parties.leaderId,
          chiefWhipId: parties.chiefWhipId,
          socialMediaOfficerId: parties.socialMediaOfficerId,
        })
        .from(parties)
        .where(and(eq(parties.id, data.partyId), isNull(parties.archivedAt)))
        .for("update");
      if (!party || party.leaderId !== actor?.id)
        throw new Error(
          "Only the party leader can appoint or dismiss officers",
        );
      if (data.userId !== null) {
        const [member] = await tx
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.id, data.userId),
              eq(users.partyId, data.partyId),
              eq(users.isActive, true),
            ),
          )
          .limit(1);
        if (
          !member ||
          data.userId === actor.id ||
          data.userId ===
            (data.office === "chiefWhip"
              ? party.socialMediaOfficerId
              : party.chiefWhipId)
        )
          throw new Error(
            "Choose another active party member who does not hold an office",
          );
      }
      await tx
        .update(parties)
        .set(
          data.office === "chiefWhip"
            ? { chiefWhipId: data.userId }
            : { socialMediaOfficerId: data.userId },
        )
        .where(eq(parties.id, data.partyId));
      return true;
    });
  });

export const ejectPartyMember = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      partyId: z.number().int().positive(),
      userId: z.number().int().positive(),
    }),
  )
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
        .where(userEmailEquals(context.user!.email!))
        .limit(1);
      if (
        !actor?.active ||
        actor.partyId !== data.partyId ||
        actor.id === data.userId
      )
        throw new Error("Only the Party Leader can expel another party member");
      const [party] = await tx
        .select({ name: parties.name })
        .from(parties)
        .where(
          and(
            eq(parties.id, data.partyId),
            eq(parties.leaderId, actor.id),
            isNull(parties.archivedAt),
          ),
        )
        .for("update");
      if (!party)
        throw new Error("Only the Party Leader can expel a party member");
      const [member] = await tx
        .update(users)
        .set({ partyId: null })
        .where(and(eq(users.id, data.userId), eq(users.partyId, data.partyId)))
        .returning({ username: users.username });
      if (!member) throw new Error("This player is no longer a member");
      await tx
        .update(parties)
        .set({ chiefWhipId: null })
        .where(
          and(
            eq(parties.id, data.partyId),
            eq(parties.chiefWhipId, data.userId),
          ),
        );
      await tx
        .update(parties)
        .set({ socialMediaOfficerId: null })
        .where(
          and(
            eq(parties.id, data.partyId),
            eq(parties.socialMediaOfficerId, data.userId),
          ),
        );
      await tx
        .update(parties)
        .set({ leaderId: null })
        .where(
          and(eq(parties.id, data.partyId), eq(parties.leaderId, data.userId)),
        );
      await tx.insert(feed).values({
        userId: actor.id,
        content: `ejected ${member.username} from ${party.name}`,
      });
      return true;
    });
  });

export const leaveParty = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { userId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) {
      throw new Error("Authentication required");
    }

    const [currentUser] = await db
      .select({
        id: users.id,
        partyId: users.partyId,
      })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);

    if (!currentUser || currentUser.id !== data.userId) {
      throw new Error("You can only leave a party as yourself");
    }

    await db.transaction(async (tx) => {
      const [member] = await tx
        .select({ partyId: users.partyId })
        .from(users)
        .where(eq(users.id, currentUser.id))
        .for("update");
      if (!member?.partyId) return;
      const previousPartyId = member.partyId;
      await tx.execute(sql`select pg_advisory_xact_lock(${previousPartyId})`);
      await tx
        .update(users)
        .set({ partyId: null })
        .where(eq(users.id, currentUser.id));
      await tx
        .update(parties)
        .set({ chiefWhipId: null })
        .where(
          and(
            eq(parties.id, previousPartyId),
            eq(parties.chiefWhipId, currentUser.id),
          ),
        );
      await tx
        .update(parties)
        .set({ socialMediaOfficerId: null })
        .where(
          and(
            eq(parties.id, previousPartyId),
            eq(parties.socialMediaOfficerId, currentUser.id),
          ),
        );
      const archived = await archivePartyIfEmpty(
        tx,
        previousPartyId,
        currentUser.id,
      );
      if (!archived) {
        await tx
          .update(parties)
          .set({ leaderId: null })
          .where(
            and(
              eq(parties.id, previousPartyId),
              eq(parties.leaderId, currentUser.id),
            ),
          );
      }
      const [party] = await tx
        .select({ name: parties.name })
        .from(parties)
        .where(eq(parties.id, previousPartyId))
        .limit(1);
      await tx.insert(feed).values({
        userId: currentUser.id,
        content: `left ${party?.name ?? "their party"}`,
      });
    });
    return true;
  });

export const becomePartyLeader = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { userId: number; partyId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) {
      throw new Error("Authentication required");
    }

    // Verify the authenticated user matches the userId
    const [currentUser] = await db
      .select({ id: users.id, partyId: users.partyId })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);

    if (!currentUser || currentUser.id !== data.userId) {
      throw new Error("You can only become leader as yourself");
    }

    await db.transaction(async (tx) => {
      const [member] = await tx
        .select({ partyId: users.partyId })
        .from(users)
        .where(eq(users.id, currentUser.id))
        .for("update");
      if (member?.partyId !== data.partyId) {
        throw new Error("You must be a member of the party to become leader");
      }
      const [party] = await tx
        .update(parties)
        .set({ leaderId: currentUser.id })
        .where(
          and(
            eq(parties.id, data.partyId),
            isNull(parties.archivedAt),
            isNull(parties.leaderId),
          ),
        )
        .returning({ name: parties.name });
      if (!party) throw new Error("Party already has a leader or is archived");
      await tx
        .update(parties)
        .set({ chiefWhipId: null })
        .where(
          and(
            eq(parties.id, data.partyId),
            eq(parties.chiefWhipId, currentUser.id),
          ),
        );
      await tx
        .update(parties)
        .set({ socialMediaOfficerId: null })
        .where(
          and(
            eq(parties.id, data.partyId),
            eq(parties.socialMediaOfficerId, currentUser.id),
          ),
        );
      await tx.insert(feed).values({
        userId: currentUser.id,
        content: `became leader of ${party.name}`,
      });
    });
    return true;
  });

export const getPartyRevivalState = createServerFn()
  .middleware([authMiddleware])
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) return { canRevive: false };
    const [[actor], [party]] = await Promise.all([
      db
        .select({ id: users.id, partyId: users.partyId })
        .from(users)
        .where(userEmailEquals(context.user.email))
        .limit(1),
      db
        .select({
          archivedAt: parties.archivedAt,
          formerLeaderId: parties.formerLeaderId,
        })
        .from(parties)
        .where(eq(parties.id, data.partyId))
        .limit(1),
    ]);
    if (!actor || !party?.archivedAt) return { canRevive: false };
    return {
      canRevive: canReviveParty({
        actorUserId: actor.id,
        actorPartyId: actor.partyId,
        formerLeaderId: party.formerLeaderId,
        isAdmin: isAdminEmail(context.user.email),
      }),
    };
  });

export const reviveParty = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const actorEmail = context.user.email;
    const [actor] = await db
      .select({ id: users.id, partyId: users.partyId })
      .from(users)
      .where(userEmailEquals(actorEmail))
      .limit(1);
    if (!actor) throw new Error("Player account not found");

    return db.transaction(async (tx) => {
      const [member] = await tx
        .select({ partyId: users.partyId })
        .from(users)
        .where(eq(users.id, actor.id))
        .for("update");
      if (!member || member.partyId) {
        throw new Error("Leave your current party before reviving this party");
      }
      await tx.execute(sql`select pg_advisory_xact_lock(${data.partyId})`);
      const [party] = await tx
        .select({
          id: parties.id,
          name: parties.name,
          archivedAt: parties.archivedAt,
          formerLeaderId: parties.formerLeaderId,
        })
        .from(parties)
        .where(eq(parties.id, data.partyId))
        .limit(1);
      if (!party?.archivedAt) throw new Error("Archived party not found");
      if (
        !canReviveParty({
          actorUserId: actor.id,
          actorPartyId: member.partyId,
          formerLeaderId: party.formerLeaderId,
          isAdmin: isAdminEmail(actorEmail),
        })
      ) {
        throw new Error(
          "Only an independent former leader or independent admin can revive this party",
        );
      }

      const [restoredMember] = await tx
        .update(users)
        .set({ partyId: party.id })
        .where(and(eq(users.id, actor.id), isNull(users.partyId)))
        .returning({ id: users.id });
      if (!restoredMember) {
        throw new Error("Leave your current party before reviving this party");
      }
      await tx
        .update(parties)
        .set({ archivedAt: null, leaderId: actor.id })
        .where(eq(parties.id, party.id));
      await tx.insert(organizationLifecycleEvents).values({
        organizationType: "party",
        organizationId: party.id,
        organizationName: party.name,
        action: "revived",
        actorUserId: actor.id,
        metadata: { restoredLeaderId: actor.id },
      });
      await tx.insert(feed).values({
        userId: actor.id,
        content: `revived ${party.name}`,
      });
      return true;
    });
  });

const GetPartiesByIdsSchema = z.object({
  partyIds: z.array(z.number()).min(1),
});

export const getPartiesByIds = createServerFn()
  .inputValidator((data: unknown) => GetPartiesByIdsSchema.parse(data))
  .handler(async ({ data }) => {
    const { partyIds } = data;

    if (partyIds.length === 0) return {};

    try {
      const results = await db
        .select({
          id: parties.id,
          name: parties.name,
          color: parties.color,
          logo: parties.logo,
        })
        .from(parties)
        .where(inArray(parties.id, partyIds));

      const partyMap: Record<number, (typeof results)[0]> = {};
      results.forEach((party) => {
        partyMap[party.id] = party;
      });

      return partyMap;
    } catch (error) {
      console.error("Error fetching parties:", error);
      throw new Error("Failed to fetch parties");
    }
  });
