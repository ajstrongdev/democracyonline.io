import { createServerFn } from '@tanstack/react-start'
import {
  users,
  bills,
  billVotesHouse,
  billVotesSenate,
  billVotesPresidential,
} from '@/db/schema'
import { eq, getTableColumns } from 'drizzle-orm'
import { db } from '@/db'
import { UpdateUserProfileSchema } from '@/lib/schemas/user-schema'

export const fetchUserInfo = createServerFn()
  .inputValidator((data: { userId: number }) => data)
  .handler(async ({ data }) => {
    const { email, ...userColumns } = getTableColumns(users)
    const user = await db
      .select(userColumns)
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1)
    return user
  })

export const fetchUserInfoByEmail = createServerFn()
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const { email, ...userColumns } = getTableColumns(users)
    const user = await db
      .select(userColumns)
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1)
    return user
  })

export const getUserFullById = createServerFn()
  .inputValidator((data: { userId: number; checkActive?: boolean }) => data)
  .handler(async ({ data }) => {
    const { email, ...userColumns } = getTableColumns(users)
    const user = await db
      .select(userColumns)
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1)

    if (user.length === 0) {
      throw new Error('User not found')
    }

    const userData = user[0]

    if (data.checkActive && !userData.isActive) {
      throw new Error('Profile not available')
    }

    return userData
  })

export const updateUserProfile = createServerFn()
  .inputValidator(UpdateUserProfileSchema.parse)
  .handler(async ({ data }) => {
    const updatedUser = await db
      .update(users)
      .set({
        username: data.username,
        bio: data.bio,
        politicalLeaning: data.politicalLeaning,
      })
      .where(eq(users.id, data.userId))
      .returning()

    if (updatedUser.length === 0) {
      throw new Error('Failed to update user profile')
    }

    return updatedUser[0]
  })

export const getUserVotingHistory = createServerFn()
  .inputValidator((data: { userId: number }) => data)
  .handler(async ({ data }) => {
    // Get house votes
    const houseVotes = await db
      .select({
        id: billVotesHouse.id,
        billId: billVotesHouse.billId,
        voteYes: billVotesHouse.voteYes,
        billTitle: bills.title,
        billStatus: bills.status,
        stage: bills.stage,
      })
      .from(billVotesHouse)
      .innerJoin(bills, eq(billVotesHouse.billId, bills.id))
      .where(eq(billVotesHouse.voterId, data.userId))

    // Get senate votes
    const senateVotes = await db
      .select({
        id: billVotesSenate.id,
        billId: billVotesSenate.billId,
        voteYes: billVotesSenate.voteYes,
        billTitle: bills.title,
        billStatus: bills.status,
        stage: bills.stage,
      })
      .from(billVotesSenate)
      .innerJoin(bills, eq(billVotesSenate.billId, bills.id))
      .where(eq(billVotesSenate.voterId, data.userId))

    // Get presidential votes
    const presidentialVotes = await db
      .select({
        id: billVotesPresidential.id,
        billId: billVotesPresidential.billId,
        voteYes: billVotesPresidential.voteYes,
        billTitle: bills.title,
        billStatus: bills.status,
        stage: bills.stage,
      })
      .from(billVotesPresidential)
      .innerJoin(bills, eq(billVotesPresidential.billId, bills.id))
      .where(eq(billVotesPresidential.voterId, data.userId))

    // Combine all votes and sort by ID
    const allVotes = [...houseVotes, ...senateVotes, ...presidentialVotes].sort(
      (a, b) => b.id - a.id,
    )

    return allVotes
  })
