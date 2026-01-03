import { createServerFn } from '@tanstack/react-start'
import {
  parties,
  users,
  partyStances,
  mergeRequest,
  mergeRequestStances,
  partyNotifications,
  feed,
} from '@/db/schema'
import { eq, and, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  CreateMergeRequestSchema,
  AcceptMergeRequestSchema,
  RejectMergeRequestSchema,
  CancelMergeRequestSchema,
} from '@/lib/schemas/merge-request-schema'

// Get merge requests received by a party (where this party is receiver)
export const getMergeRequestsReceived = createServerFn()
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data }) => {
    const requests = await db
      .select({
        mergeRequestId: partyNotifications.mergeRequestId,
        senderPartyId: partyNotifications.senderPartyId,
        senderPartyName: parties.name,
        senderPartyColor: parties.color,
        senderPartyLogo: parties.logo,
        status: partyNotifications.status,
        createdAt: partyNotifications.createdAt,
        mergedPartyName: mergeRequest.name,
        mergedPartyColor: mergeRequest.color,
        mergedPartyBio: mergeRequest.bio,
        mergedPartyLeaning: mergeRequest.leaning,
        mergedPartyLogo: mergeRequest.logo,
      })
      .from(partyNotifications)
      .innerJoin(
        mergeRequest,
        eq(partyNotifications.mergeRequestId, mergeRequest.id),
      )
      .innerJoin(parties, eq(partyNotifications.senderPartyId, parties.id))
      .where(
        and(
          eq(partyNotifications.receiverPartyId, data.partyId),
          eq(partyNotifications.status, 'Pending'),
        ),
      )
    return requests
  })

// Get merge requests sent by a party (where this party is sender)
export const getMergeRequestsSent = createServerFn()
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data }) => {
    const requests = await db
      .select({
        mergeRequestId: partyNotifications.mergeRequestId,
        receiverPartyId: partyNotifications.receiverPartyId,
        receiverPartyName: parties.name,
        receiverPartyColor: parties.color,
        receiverPartyLogo: parties.logo,
        status: partyNotifications.status,
        createdAt: partyNotifications.createdAt,
        mergedPartyName: mergeRequest.name,
        mergedPartyColor: mergeRequest.color,
        mergedPartyBio: mergeRequest.bio,
        mergedPartyLeaning: mergeRequest.leaning,
        mergedPartyLogo: mergeRequest.logo,
      })
      .from(partyNotifications)
      .innerJoin(
        mergeRequest,
        eq(partyNotifications.mergeRequestId, mergeRequest.id),
      )
      .innerJoin(parties, eq(partyNotifications.receiverPartyId, parties.id))
      .where(
        and(
          eq(partyNotifications.senderPartyId, data.partyId),
          eq(partyNotifications.status, 'Pending'),
        ),
      )
    return requests
  })

// Get count of pending merge requests for a party (received only)
export const getMergeRequestCount = createServerFn()
  .inputValidator((data: { partyId: number }) => data)
  .handler(async ({ data }) => {
    const [result] = await db
      .select({ count: sql<number>`count(*)`.as('count') })
      .from(partyNotifications)
      .where(
        and(
          eq(partyNotifications.receiverPartyId, data.partyId),
          eq(partyNotifications.status, 'Pending'),
        ),
      )
    return result?.count || 0
  })

// Create a new merge request
export const createMergeRequest = createServerFn()
  .inputValidator(CreateMergeRequestSchema)
  .handler(async ({ data }) => {
    const { senderPartyId, receiverPartyId, mergedPartyData, stances } = data

    // Validate both parties exist
    const [senderParty, receiverParty] = await Promise.all([
      db.select().from(parties).where(eq(parties.id, senderPartyId)).limit(1),
      db.select().from(parties).where(eq(parties.id, receiverPartyId)).limit(1),
    ])

    if (!senderParty[0]) {
      throw new Error('Sender party not found')
    }
    if (!receiverParty[0]) {
      throw new Error('Receiver party not found')
    }

    // Check if there's already a pending request between these parties (in either direction)
    const existingRequest = await db
      .select()
      .from(partyNotifications)
      .where(
        and(
          or(
            and(
              eq(partyNotifications.senderPartyId, senderPartyId),
              eq(partyNotifications.receiverPartyId, receiverPartyId),
            ),
            and(
              eq(partyNotifications.senderPartyId, receiverPartyId),
              eq(partyNotifications.receiverPartyId, senderPartyId),
            ),
          ),
          eq(partyNotifications.status, 'Pending'),
        ),
      )
      .limit(1)

    if (existingRequest.length > 0) {
      throw new Error(
        'A pending merge request already exists between these parties',
      )
    }

    // Create merge request in a transaction
    const result = await db.transaction(async (tx) => {
      // Insert merge request
      const [newMergeRequest] = await tx
        .insert(mergeRequest)
        .values({
          name: mergedPartyData.name,
          color: mergedPartyData.color,
          bio: mergedPartyData.bio,
          leaning: mergedPartyData.leaning,
          logo: mergedPartyData.logo,
          leaderId: senderParty[0].leaderId,
          politicalLeaning: mergedPartyData.leaning,
        })
        .returning()

      // Insert stances
      if (stances.length > 0) {
        await tx.insert(mergeRequestStances).values(
          stances.map((stance) => ({
            mergeRequestId: newMergeRequest.id,
            stanceId: stance.stanceId,
            value: stance.value,
          })),
        )
      }

      // Insert notification
      await tx.insert(partyNotifications).values({
        senderPartyId,
        receiverPartyId,
        mergeRequestId: newMergeRequest.id,
        status: 'Pending',
      })

      return newMergeRequest
    })

    return result
  })

// Accept a merge request and perform the merge
export const acceptMergeRequest = createServerFn()
  .inputValidator(AcceptMergeRequestSchema)
  .handler(async ({ data }) => {
    const { mergeRequestId, partyId } = data

    // Validate the merge request exists and is pending
    const [notification] = await db
      .select()
      .from(partyNotifications)
      .where(
        and(
          eq(partyNotifications.mergeRequestId, mergeRequestId),
          eq(partyNotifications.receiverPartyId, partyId),
          eq(partyNotifications.status, 'Pending'),
        ),
      )
      .limit(1)

    if (!notification) {
      throw new Error('Merge request not found or already processed')
    }

    // Get merge request data
    const [mergeData] = await db
      .select()
      .from(mergeRequest)
      .where(eq(mergeRequest.id, mergeRequestId))
      .limit(1)

    if (!mergeData) {
      throw new Error('Merge request data not found')
    }

    // Get merge request stances
    const mergeStances = await db
      .select()
      .from(mergeRequestStances)
      .where(eq(mergeRequestStances.mergeRequestId, mergeRequestId))

    // Perform the merge in a transaction
    const newPartyId = await db.transaction(async (tx) => {
      // Create new party with merged data
      const [newParty] = await tx
        .insert(parties)
        .values({
          name: mergeData.name,
          color: mergeData.color,
          bio: mergeData.bio,
          leaning: mergeData.leaning,
          logo: mergeData.logo,
          leaderId: mergeData.leaderId,
          politicalLeaning: mergeData.politicalLeaning,
        })
        .returning()

      // Copy stances to new party
      if (mergeStances.length > 0) {
        const validStances = mergeStances.filter(
          (stance) => stance.value !== null,
        )
        if (validStances.length > 0) {
          await tx.insert(partyStances).values(
            validStances.map((stance) => ({
              partyId: newParty.id,
              stanceId: stance.stanceId,
              value: stance.value!,
            })),
          )
        }
      }

      // Transfer all members from both parties to new party
      await tx
        .update(users)
        .set({ partyId: newParty.id })
        .where(
          or(
            eq(users.partyId, notification.senderPartyId),
            eq(users.partyId, notification.receiverPartyId),
          ),
        )

      // Delete stances for both old parties
      await tx
        .delete(partyStances)
        .where(
          or(
            eq(partyStances.partyId, notification.senderPartyId),
            eq(partyStances.partyId, notification.receiverPartyId),
          ),
        )

      // Delete both old parties
      await tx
        .delete(parties)
        .where(
          or(
            eq(parties.id, notification.senderPartyId),
            eq(parties.id, notification.receiverPartyId),
          ),
        )

      // Update notification status
      await tx
        .update(partyNotifications)
        .set({ status: 'Accepted' })
        .where(eq(partyNotifications.mergeRequestId, mergeRequestId))

      // Add feed entry
      await tx.insert(feed).values({
        userId: null,
        content: `Two parties have merged to form ${newParty.name}!`,
      })

      return newParty.id
    })

    return { newPartyId }
  })

// Reject a merge request
export const rejectMergeRequest = createServerFn()
  .inputValidator(RejectMergeRequestSchema)
  .handler(async ({ data }) => {
    const { mergeRequestId, partyId } = data

    // Validate the merge request exists and is pending
    const [notification] = await db
      .select()
      .from(partyNotifications)
      .where(
        and(
          eq(partyNotifications.mergeRequestId, mergeRequestId),
          eq(partyNotifications.receiverPartyId, partyId),
          eq(partyNotifications.status, 'Pending'),
        ),
      )
      .limit(1)

    if (!notification) {
      throw new Error('Merge request not found or already processed')
    }

    // Update notification status
    await db
      .update(partyNotifications)
      .set({ status: 'Rejected' })
      .where(eq(partyNotifications.mergeRequestId, mergeRequestId))

    return true
  })

// Cancel a sent merge request
export const cancelMergeRequest = createServerFn()
  .inputValidator(CancelMergeRequestSchema)
  .handler(async ({ data }) => {
    const { mergeRequestId, partyId } = data

    // Validate the merge request exists and is pending
    const [notification] = await db
      .select()
      .from(partyNotifications)
      .where(
        and(
          eq(partyNotifications.mergeRequestId, mergeRequestId),
          eq(partyNotifications.senderPartyId, partyId),
          eq(partyNotifications.status, 'Pending'),
        ),
      )
      .limit(1)

    if (!notification) {
      throw new Error('Merge request not found or already processed')
    }

    // Update notification status to Rejected (canceled by sender)
    await db
      .update(partyNotifications)
      .set({ status: 'Rejected' })
      .where(eq(partyNotifications.mergeRequestId, mergeRequestId))

    return true
  })
