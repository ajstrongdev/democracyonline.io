import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, desc, eq, getTableColumns, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  billVotesHouse,
  billVotesPresidential,
  billVotesSenate,
  bills,
  feed,
  parties,
  users,
} from "@/db/schema";
import {
  CreateBillsSchema,
  UpdateBillsSchema,
} from "@/lib/schemas/bills-schema";
import { requireAuthMiddleware } from "@/middleware/auth";
import { getBillStageDurationMs, getGameSpeed } from "@/lib/server/game-speed";
import { userEmailEquals } from "@/lib/server/user-email";

// Types
type BillStages = "house" | "senate" | "presidential";

type BillVoterData = {
  userId: number | null;
  username: string | null;
  voteYes: boolean;
  partyId: number | null;
  partyName: string | null;
  partyColor: string | null;
};

// Data fetching
export const getBills = createServerFn().handler(async () => {
  const getVoteCount = (
    name: string,
    alias: string,
    table:
      | typeof billVotesHouse
      | typeof billVotesSenate
      | typeof billVotesPresidential,
    voteYes: boolean,
  ) =>
    db.$with(name).as(
      db
        .select({
          billId: table.billId,
          count: sql<number>`COUNT(*)`.as(alias),
        })
        .from(table)
        .where(eq(table.voteYes, voteYes))
        .groupBy(table.billId),
    );

  const houseYes = getVoteCount(
    "house_yes",
    "house_yes_count",
    billVotesHouse,
    true,
  );
  const houseNo = getVoteCount(
    "house_no",
    "house_no_count",
    billVotesHouse,
    false,
  );
  const senateYes = getVoteCount(
    "senate_yes",
    "senate_yes_count",
    billVotesSenate,
    true,
  );
  const senateNo = getVoteCount(
    "senate_no",
    "senate_no_count",
    billVotesSenate,
    false,
  );
  const presYes = getVoteCount(
    "pres_yes",
    "pres_yes_count",
    billVotesPresidential,
    true,
  );
  const presNo = getVoteCount(
    "pres_no",
    "pres_no_count",
    billVotesPresidential,
    false,
  );

  const rows = await db
    .with(houseYes, houseNo, senateYes, senateNo, presYes, presNo)
    .select({
      ...getTableColumns(bills),
      creator: users.username,
      houseTotalYes: sql<number>`COALESCE(${houseYes.count}, 0)`.as(
        "house_total_yes",
      ),
      houseTotalNo: sql<number>`COALESCE(${houseNo.count}, 0)`.as(
        "house_total_no",
      ),
      senateTotalYes: sql<number>`COALESCE(${senateYes.count}, 0)`.as(
        "senate_total_yes",
      ),
      senateTotalNo: sql<number>`COALESCE(${senateNo.count}, 0)`.as(
        "senate_total_no",
      ),
      presidentialTotalYes: sql<number>`COALESCE(${presYes.count}, 0)`.as(
        "presidential_total_yes",
      ),
      presidentialTotalNo: sql<number>`COALESCE(${presNo.count}, 0)`.as(
        "presidential_total_no",
      ),
    })
    .from(bills)
    .leftJoin(users, eq(users.id, bills.creatorId))
    .leftJoin(houseYes, eq(houseYes.billId, bills.id))
    .leftJoin(houseNo, eq(houseNo.billId, bills.id))
    .leftJoin(senateYes, eq(senateYes.billId, bills.id))
    .leftJoin(senateNo, eq(senateNo.billId, bills.id))
    .leftJoin(presYes, eq(presYes.billId, bills.id))
    .leftJoin(presNo, eq(presNo.billId, bills.id))
    .orderBy(desc(bills.createdAt));

  return rows;
});

export const getBillById = createServerFn()
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const bill = await db
      .select({
        ...getTableColumns(bills),
        creator: users.username,
      })
      .from(bills)
      .leftJoin(users, eq(users.id, bills.creatorId))
      .where(eq(bills.id, data.id))
      .limit(1);
    return bill;
  });

export const getBillVotes = createServerFn()
  .inputValidator(
    z.object({
      id: z.number().int().positive(),
      stage: z.enum(["house", "senate", "presidential"]),
    }),
  )
  .handler(async ({ data }) => {
    const table =
      data.stage === "house"
        ? billVotesHouse
        : data.stage === "senate"
          ? billVotesSenate
          : billVotesPresidential;
    const [row] = await db
      .select({
        yesCount: sql<number>`count(*) filter (where ${table.voteYes} = true)::int`,
        noCount: sql<number>`count(*) filter (where ${table.voteYes} = false)::int`,
      })
      .from(table)
      .where(eq(table.billId, data.id));
    return {
      count: {
        yes: row.yesCount,
        no: row.noCount,
      },
    };
  });

export const getBillVoters = createServerFn()
  .inputValidator((data: { id: number; stage: BillStages }) => data)
  .handler(async ({ data }) => {
    const table =
      data.stage === "house"
        ? billVotesHouse
        : data.stage === "senate"
          ? billVotesSenate
          : billVotesPresidential;

    const voters = await db
      .select({
        userId: users.id,
        username: users.username,
        photoUrl: users.photoUrl,
        voteYes: table.voteYes,
        partyId: users.partyId,
        partyName: parties.name,
        partyColor: parties.color,
      })
      .from(table)
      .leftJoin(users, eq(users.id, table.voterId))
      .leftJoin(parties, eq(parties.id, users.partyId))
      .where(eq(table.billId, data.id));

    return voters;
  });

export const billPageData = createServerFn()
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const bill = await getBillById({ data: { id: data.id } });
    if (bill.length === 0) {
      return null;
    }
    const voteData: Record<
      BillStages,
      {
        count: {
          yes: number;
          no: number;
        };
      }
    > = {
      house: {
        count: { yes: 0, no: 0 },
      },
      senate: {
        count: { yes: 0, no: 0 },
      },
      presidential: {
        count: { yes: 0, no: 0 },
      },
    };
    const voterData: Record<BillStages, Array<BillVoterData>> = {
      house: [],
      senate: [],
      presidential: [],
    };
    for (const stage of Object.keys(voteData) as Array<BillStages>) {
      const votes = await getBillVotes({ data: { id: data.id, stage } });
      voteData[stage] = votes;
    }
    for (const stage of Object.keys(voterData) as Array<BillStages>) {
      const voters = await getBillVoters({ data: { id: data.id, stage } });
      voterData[stage] = voters;
    }
    return { bill: bill[0], votes: voteData, voters: voterData };
  });

// Mutations
export const reviveDefeatedBill = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(z.object({ billId: z.number().int().positive() }))
  .handler(async ({ context, data }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);
    if (!actor) throw new Error("Player not found");
    const [source] = await db
      .select({
        creatorId: bills.creatorId,
        title: bills.title,
        content: bills.content,
        status: bills.status,
      })
      .from(bills)
      .where(eq(bills.id, data.billId))
      .limit(1);
    if (!source || source.status !== "Defeated")
      throw new Error("Only defeated bills can be resubmitted");
    if (source.creatorId !== actor.id)
      throw new Error("Only the proposer can resubmit this bill");

    const stageDurationMs = getBillStageDurationMs(
      (await getGameSpeed()).multiplier,
    );
    return db.transaction(async (tx) => {
      const [revived] = await tx
        .insert(bills)
        .values({
          title: source.title,
          content: source.content,
          creatorId: actor.id,
          stageStartedAt: new Date(),
          stageEndsAt: new Date(Date.now() + stageDurationMs),
        })
        .returning({ id: bills.id });
      await tx.insert(feed).values({
        userId: actor.id,
        content: `Resubmitted defeated Bill #${data.billId} as Bill #${revived.id}: ${source.title}`,
      });
      return revived;
    });
  });

export const createBill = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator(CreateBillsSchema)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);
    if (!actor || actor.id !== data.creatorId)
      throw new Error("You can only create your own bills");
    const stageDurationMs = getBillStageDurationMs(
      (await getGameSpeed()).multiplier,
    );
    return db.transaction(async (tx) => {
      const result = await tx
        .insert(bills)
        .values({
          title: data.title,
          content: data.content,
          creatorId: data.creatorId,
          stageStartedAt: new Date(),
          stageEndsAt: new Date(Date.now() + stageDurationMs),
        })
        .returning({ id: bills.id });
      await tx.insert(feed).values({
        userId: data.creatorId,
        content: `Created a new bill: "Bill #${result[0].id}: ${data.title}"`,
      });
      return result;
    });
  });

export const getBillForEdit = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { id: number; userId: number }) => data)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);
    if (!actor || actor.id !== data.userId)
      throw new Error("You can only edit your own bills");
    const bill = await db
      .select({
        ...getTableColumns(bills),
        creator: users.username,
      })
      .from(bills)
      .leftJoin(users, eq(users.id, bills.creatorId))
      .where(eq(bills.id, data.id))
      .limit(1);

    if (bill.length === 0) {
      throw new Error("Bill not found");
    }

    if (bill[0].creatorId !== data.userId) {
      throw new Error("You are not authorized to edit this bill");
    }

    if (bill[0].status !== "Committee") {
      throw new Error("Only bills in Senate Committee can be edited");
    }

    return bill[0];
  });

export const updateBill = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator(UpdateBillsSchema)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const [actor] = await db
      .select({ id: users.id })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);
    if (!actor || actor.id !== data.creatorId)
      throw new Error("You can only edit your own bills");
    // Fetch the bill to validate ownership and status
    const existingBill = await db
      .select()
      .from(bills)
      .where(eq(bills.id, data.id))
      .limit(1);

    if (existingBill.length === 0) {
      throw new Error("Bill not found");
    }

    if (existingBill[0].creatorId !== data.creatorId) {
      throw new Error("You are not authorized to edit this bill");
    }

    if (existingBill[0].status !== "Committee") {
      throw new Error("Only bills in Senate Committee can be edited");
    }

    // Update only title and content
    return db.transaction(async (tx) => {
      const result = await tx
        .update(bills)
        .set({ title: data.title, content: data.content })
        .where(
          and(
            eq(bills.id, data.id),
            eq(bills.creatorId, actor.id),
            eq(bills.status, "Committee"),
            gt(bills.stageEndsAt, new Date()),
          ),
        )
        .returning({ id: bills.id });
      if (!result.length)
        throw new Error("Senate Committee has closed for this bill");
      await tx.insert(feed).values({
        userId: data.creatorId,
        content: `Updated bill: "Bill #${data.id}: ${data.title}"`,
      });
      return result;
    });
  });
