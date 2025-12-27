import { createServerFn } from '@tanstack/react-start'
import { parties, users, politicalStances, partyStances } from '@/db/schema'
import { eq, sql, getTableColumns } from 'drizzle-orm'
import { db } from '@/db'
import { CreatePartySchema } from '@/lib/schemas/party-schema'

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

export const getPartyById = createServerFn()
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data }) => {
    const [party] = await db
      .select()
      .from(parties)
      .where(eq(parties.id, data.partyId))
      .limit(1)
    return party || null
  })

export const getPoliticalStances = createServerFn().handler(async () => {
  const stances = await db.select().from(politicalStances)
  return stances
})

export const createParty = createServerFn()
  .inputValidator(CreatePartySchema)
  .handler(async ({ data }) => {
    const { party, stances } = data
    const result = await db.transaction(async (tx) => {
      const [newParty] = await tx
        .insert(parties)
        .values({
          name: party.name,
          leaderId: party.leader_id,
          bio: party.bio,
          color: party.color,
          logo: party.logo,
          discord: party.discord,
          leaning: party.leaning,
        })
        .returning()

      await tx
        .update(users)
        .set({ partyId: newParty.id })
        .where(eq(users.id, party.leader_id))
        .returning()

      if (stances.length > 0) {
        await tx.insert(partyStances).values(
          stances.map((stance) => ({
            partyId: newParty.id,
            stanceId: stance.stanceId,
            value: stance.value,
          })),
        )
      }

      return newParty
    })
    return result
  })
