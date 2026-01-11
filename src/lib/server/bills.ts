import { createServerFn } from "@tanstack/react-start";
import { desc, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  billVotesHouse,
  billVotesPresidential,
  billVotesSenate,
  bills,
  parties,
  users,
} from "@/db/schema";
import { CreateBillsSchema } from "@/lib/schemas/bills-schema";
import { requireAuthMiddleware } from "@/middleware/auth";
import { addFeedItem } from "@/lib/server/feed";

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
      .select()
      .from(bills)
      .where(eq(bills.id, data.id))
      .limit(1);
    return bill;
  });

export const getBillVotes = createServerFn()
  .inputValidator((data: { id: number; stage: BillStages }) => data)
  .handler(async ({ data }) => {
    const votes = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE vote_yes = TRUE) as yes_count,
        COUNT(*) FILTER (WHERE vote_yes = FALSE) as no_count
        FROM ${sql.raw(`bill_votes_${data.stage.toLowerCase()}`)}
        WHERE bill_id = ${data.id}
    `);
    const row = votes.rows[0] as { yes_count: string; no_count: string };
    return {
      count: {
        yes: parseInt(row.yes_count, 10),
        no: parseInt(row.no_count, 10),
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
export const createBill = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator(CreateBillsSchema)
  .handler(async ({ data }) => {
    const result = await db
      .insert(bills)
      .values({
        title: data.title,
        content: data.content,
        creatorId: data.creatorId,
      })
      .returning({ id: bills.id });

    const billId = result[0].id;

    await addFeedItem({
      data: {
        userId: data.creatorId,
        content: `Created a new bill: "Bill #${billId} - ${data.title}"`,
      },
    });
    return result;
  });
