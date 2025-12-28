import { createServerFn } from '@tanstack/react-start'
import { parties, users, politicalStances, partyStances } from '@/db/schema'
import { eq, sql, getTableColumns } from 'drizzle-orm'
import { db } from '@/db'
import {
  CreatePartySchema,
  UpdatePartySchema,
} from '@/lib/schemas/party-schema'

// Data fetching
export const partyPageData = createServerFn()
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const partyInfo = await getParties()
    const isInParty = await checkUserInParty({ data: { email: data.email } })
    return { partyInfo, isInParty }
  })

export const getParties = createServerFn().handler(async () => {
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

export const checkUserInSpecificParty = createServerFn()
  .inputValidator((data: { userId: number; partyId: number }) => data)
  .handler(async ({ data }) => {
    const [user] = await db
      .select({ partyId: users.partyId })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1)
    return user?.partyId === data.partyId
  })

export const checkIfUserIsPartyLeader = createServerFn()
  .inputValidator((data: { userId: number; partyId: number }) => data)
  .handler(async ({ data }) => {
    const [party] = await db
      .select({ leaderId: parties.leaderId })
      .from(parties)
      .where(eq(parties.id, data.partyId))
      .limit(1)
    return party?.leaderId === data.userId
  })

export const getMembershipStatus = createServerFn()
  .inputValidator((data: { userId: number; partyId: number }) => data)
  .handler(async ({ data }) => {
    const isInParty = await checkUserInSpecificParty({
      data: { userId: data.userId, partyId: data.partyId },
    })
    const isLeader = await checkIfUserIsPartyLeader({
      data: { userId: data.userId, partyId: data.partyId },
    })
    return { isInParty, isLeader }
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

export const getPartyStances = createServerFn()
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data }) => {
    const stances = await db
      .select({
        title: politicalStances.issue,
        value: partyStances.value,
        stanceId: partyStances.stanceId,
      })
      .from(partyStances)
      .innerJoin(
        politicalStances,
        eq(partyStances.stanceId, politicalStances.id),
      )
      .where(eq(partyStances.partyId, data.partyId))
    return stances
  })

export const getPartyDetails = createServerFn()
  .inputValidator((data: { partyId: number; userId: number | null }) => data)
  .handler(async ({ data }) => {
    const party = await getPartyById({ data: { partyId: data.partyId } })
    const members = await getPartyMembers({ data: { partyId: data.partyId } })
    const stances = await getPartyStances({ data: { partyId: data.partyId } })
    const membershipStatus = data.userId
      ? await getMembershipStatus({
          data: { userId: data.userId, partyId: data.partyId },
        })
      : { isInParty: false, isLeader: false }

    return {
      party,
      members,
      stances,
      membershipStatus,
    }
  })

export const getPoliticalStances = createServerFn().handler(async () => {
  const stances = await db.select().from(politicalStances)
  return stances
})

// Mutations
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

export const updateParty = createServerFn()
  .inputValidator(UpdatePartySchema)
  .handler(async ({ data }) => {
    const { party, stances } = data
    await db.transaction(async (tx) => {
      await tx
        .update(parties)
        .set({
          name: party.name,
          bio: party.bio,
          color: party.color,
          logo: party.logo,
          discord: party.discord,
          leaning: party.leaning,
        })
        .where(eq(parties.id, party.id))

      await tx.delete(partyStances).where(eq(partyStances.partyId, party.id))

      if (stances.length > 0) {
        await tx.insert(partyStances).values(
          stances.map((stance) => ({
            partyId: party.id!,
            stanceId: stance.stanceId,
            value: stance.value,
          })),
        )
      }
    })
    return true
  })

export const leaveParty = createServerFn()
  .inputValidator((data: { userId: number }) => data)
  .handler(async ({ data }) => {
    const [user] = await db
      .select({ partyId: users.partyId })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1)
    if (user?.partyId) {
      const [party] = await db
        .select({ leaderId: parties.leaderId })
        .from(parties)
        .where(eq(parties.id, user.partyId))
        .limit(1)
      if (party?.leaderId === data.userId) {
        await db
          .update(parties)
          .set({ leaderId: null })
          .where(eq(parties.id, user.partyId))
      }
    }

    await db
      .update(users)
      .set({ partyId: null })
      .where(eq(users.id, data.userId))

    if (user?.partyId) {
      const memberCount = await db
        .select()
        .from(users)
        .where(eq(users.partyId, user.partyId))

      if (memberCount.length === 0) {
        await deleteParty({ data: { partyId: user.partyId } })
      }
    }
    return true
  })

export const deleteParty = createServerFn()
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data }) => {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ partyId: null })
        .where(eq(users.partyId, data.partyId))
      await tx
        .delete(partyStances)
        .where(eq(partyStances.partyId, data.partyId))
      // Delete party notifications where this party is sender or receiver
      // Note: Assuming partyNotifications is imported if it exists in schema
      // await tx.delete(partyNotifications).where(
      //   or(
      //     eq(partyNotifications.senderPartyId, data.partyId),
      //     eq(partyNotifications.receiverPartyId, data.partyId)
      //   )
      // )
      await tx.delete(parties).where(eq(parties.id, data.partyId))
    })
    return true
  })

export const joinParty = createServerFn()
  .inputValidator((data: { userId: number; partyId: number }) => data)
  .handler(async ({ data }) => {
    await db
      .update(users)
      .set({ partyId: data.partyId })
      .where(eq(users.id, data.userId))
    return true
  })

export const becomePartyLeader = createServerFn()
  .inputValidator((data: { userId: number; partyId: number }) => data)
  .handler(async ({ data }) => {
    await db
      .update(parties)
      .set({ leaderId: data.userId })
      .where(eq(parties.id, data.partyId))
    return true
  })
