import { createServerFn } from "@tanstack/react-start";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  billComments,
  billPartyWhips,
  bills,
  feed,
  parties,
  users,
} from "@/db/schema";
import { db } from "@/db";
import { authMiddleware, requireAuthMiddleware } from "@/middleware/auth";
import { userEmailEquals } from "@/lib/server/user-email";

export const getBillComments = createServerFn()
  .inputValidator(z.object({ billId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    return db
      .select({
        id: billComments.id,
        userId: billComments.userId,
        username: billComments.username,
        photoUrl: users.photoUrl,
        partyName: billComments.partyName,
        isPartyLeader: billComments.isPartyLeader,
        content: billComments.content,
        createdAt: billComments.createdAt,
      })
      .from(billComments)
      .leftJoin(users, eq(users.id, billComments.userId))
      .where(eq(billComments.billId, data.billId))
      .orderBy(asc(billComments.createdAt), asc(billComments.id));
  });

export const addBillComment = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      billId: z.number().int().positive(),
      content: z.string().trim().min(1).max(5_000),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    return db.transaction(async (tx) => {
      const [author] = await tx
        .select({
          id: users.id,
          username: users.username,
          isActive: users.isActive,
          partyId: users.partyId,
          partyName: parties.name,
          partyLeaderId: parties.leaderId,
          partyArchivedAt: parties.archivedAt,
        })
        .from(users)
        .leftJoin(parties, eq(parties.id, users.partyId))
        .where(userEmailEquals(context.user!.email!))
        .limit(1);
      if (!author) throw new Error("Player account not found");
      if (!author.isActive)
        throw new Error("Active players can comment on bills");
      const [bill] = await tx
        .select({ id: bills.id, title: bills.title })
        .from(bills)
        .where(eq(bills.id, data.billId))
        .limit(1);
      if (!bill) throw new Error("Bill not found");

      const [comment] = await tx
        .insert(billComments)
        .values({
          billId: bill.id,
          userId: author.id,
          username: author.username,
          partyName: author.partyName,
          isPartyLeader:
            !!author.partyId &&
            author.partyLeaderId === author.id &&
            author.partyArchivedAt === null,
          content: data.content,
        })
        .returning({ id: billComments.id });
      await tx.insert(feed).values({
        userId: author.id,
        content: `Commented on bill #${bill.id}: ${bill.title}`,
      });
      return comment;
    });
  });

export const getBillWhips = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(z.object({ billId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    const [currentUser] = context.user?.email
      ? await db
          .select({
            id: users.id,
            partyId: users.partyId,
            isActive: users.isActive,
            leaderId: parties.leaderId,
            archivedAt: parties.archivedAt,
          })
          .from(users)
          .leftJoin(parties, eq(parties.id, users.partyId))
          .where(userEmailEquals(context.user.email))
          .limit(1)
      : [];
    const whips = await db
      .select({
        id: billPartyWhips.id,
        partyId: billPartyWhips.partyId,
        partyName: parties.name,
        partyColor: parties.color,
        leaderUsername: users.username,
        position: billPartyWhips.position,
        note: billPartyWhips.note,
        updatedAt: billPartyWhips.updatedAt,
      })
      .from(billPartyWhips)
      .innerJoin(parties, eq(parties.id, billPartyWhips.partyId))
      .leftJoin(users, eq(users.id, billPartyWhips.leaderUserId))
      .where(eq(billPartyWhips.billId, data.billId))
      .orderBy(asc(parties.name));

    const [bill] = await db
      .select({ status: bills.status })
      .from(bills)
      .where(eq(bills.id, data.billId))
      .limit(1);
    const isLeader = Boolean(
      currentUser?.isActive &&
      currentUser.partyId &&
      currentUser.leaderId === currentUser.id &&
      currentUser.archivedAt === null,
    );
    return {
      whips,
      currentPartyId: currentUser?.partyId ?? null,
      canWhip: isLeader && bill?.status === "Voting",
      isVoting: bill?.status === "Voting",
    };
  });

export const saveBillWhip = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(
    z.object({
      billId: z.number().int().positive(),
      position: z.enum(["For", "Against"]),
      note: z.string().trim().max(1_000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    return db.transaction(async (tx) => {
      const [leader] = await tx
        .select({
          id: users.id,
          partyId: users.partyId,
          isActive: users.isActive,
          partyName: parties.name,
          leaderId: parties.leaderId,
          archivedAt: parties.archivedAt,
        })
        .from(users)
        .leftJoin(parties, eq(parties.id, users.partyId))
        .where(userEmailEquals(context.user!.email!))
        .limit(1);
      if (
        !leader?.isActive ||
        !leader.partyId ||
        leader.leaderId !== leader.id ||
        leader.archivedAt !== null
      ) {
        throw new Error("Only active party leaders can issue voting guidance");
      }
      const [bill] = await tx
        .select({ id: bills.id, title: bills.title, status: bills.status })
        .from(bills)
        .where(eq(bills.id, data.billId))
        .limit(1);
      if (!bill) throw new Error("Bill not found");
      if (bill.status !== "Voting")
        throw new Error(
          "Voting guidance can only be set while a bill is in voting",
        );

      await tx
        .insert(billPartyWhips)
        .values({
          billId: bill.id,
          partyId: leader.partyId,
          leaderUserId: leader.id,
          position: data.position,
          note: data.note || null,
        })
        .onConflictDoUpdate({
          target: [billPartyWhips.billId, billPartyWhips.partyId],
          set: {
            leaderUserId: leader.id,
            position: data.position,
            note: data.note || null,
            updatedAt: sql`now()`,
          },
        });
      await tx.insert(feed).values({
        userId: leader.id,
        content: `issued ${data.position.toLowerCase()} voting guidance for ${leader.partyName} on bill #${bill.id}: ${bill.title}`,
      });
      return { success: true };
    });
  });
