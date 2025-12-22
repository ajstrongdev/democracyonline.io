import { createServerFn } from '@tanstack/react-start'
import { parties, users } from '@/db/schema'
import { eq, sql, getTableColumns } from 'drizzle-orm'
import { db } from '@/db'

export const partyPageData = createServerFn()
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const partyInfo = await getPartyInfo()
    const isInParty = await checkUserInParty({ data: { email: data.email } })
    return { partyInfo, isInParty }
  })

export const getPartyInfo = createServerFn().handler(async () => {
  const rows = await db
    .select({
      ...getTableColumns(parties),
      memberCount: sql<number>`count(${users.id})`.as('memberCount'),
    })
    .from(parties)
    .leftJoin(users, eq(users.partyId, parties.id))
    .groupBy(parties.id)
    .orderBy(sql`count(${users.id}) desc`)
  return rows
})

export const checkUserInParty = createServerFn()
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const [user] = await db
      .select({ partyId: users.partyId })
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1)

    return user?.partyId !== null && user?.partyId !== undefined
  })

export const getPartyMembers = createServerFn()
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data }) => {
    const { email, ...userColumns } = getTableColumns(users)
    const members = await db
      .select(userColumns)
      .from(users)
      .where(eq(users.partyId, data.partyId))
    return members
  })
