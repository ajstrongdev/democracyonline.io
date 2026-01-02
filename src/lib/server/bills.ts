import { createServerFn } from '@tanstack/react-start'
import { eq, sql, getTableColumns, desc } from 'drizzle-orm'
import { db } from '@/db'
import {
  bills,
  users,
  billVotesHouse,
  billVotesSenate,
  billVotesPresidential,
} from '@/db/schema'
import { CreateBillsSchema } from '@/lib/schemas/bills-schema'

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
    )

  const houseYes = getVoteCount(
    'house_yes',
    'house_yes_count',
    billVotesHouse,
    true,
  )
  const houseNo = getVoteCount(
    'house_no',
    'house_no_count',
    billVotesHouse,
    false,
  )
  const senateYes = getVoteCount(
    'senate_yes',
    'senate_yes_count',
    billVotesSenate,
    true,
  )
  const senateNo = getVoteCount(
    'senate_no',
    'senate_no_count',
    billVotesSenate,
    false,
  )
  const presYes = getVoteCount(
    'pres_yes',
    'pres_yes_count',
    billVotesPresidential,
    true,
  )
  const presNo = getVoteCount(
    'pres_no',
    'pres_no_count',
    billVotesPresidential,
    false,
  )

  const rows = await db
    .with(houseYes, houseNo, senateYes, senateNo, presYes, presNo)
    .select({
      ...getTableColumns(bills),
      creator: users.username,
      houseTotalYes: sql<number>`COALESCE(${houseYes.count}, 0)`.as(
        'house_total_yes',
      ),
      houseTotalNo: sql<number>`COALESCE(${houseNo.count}, 0)`.as(
        'house_total_no',
      ),
      senateTotalYes: sql<number>`COALESCE(${senateYes.count}, 0)`.as(
        'senate_total_yes',
      ),
      senateTotalNo: sql<number>`COALESCE(${senateNo.count}, 0)`.as(
        'senate_total_no',
      ),
      presidentialTotalYes: sql<number>`COALESCE(${presYes.count}, 0)`.as(
        'presidential_total_yes',
      ),
      presidentialTotalNo: sql<number>`COALESCE(${presNo.count}, 0)`.as(
        'presidential_total_no',
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
    .orderBy(desc(bills.createdAt))

  return rows
})

// Mutations
export const createBill = createServerFn()
  .inputValidator(CreateBillsSchema)
  .handler(async ({ data }) => {
    const result = await db
      .insert(bills)
      .values({
        title: data.title,
        content: data.content,
        creatorId: data.creatorId,
      })
    return result
  })
