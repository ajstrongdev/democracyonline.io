import { createServerFn } from "@tanstack/react-start";
import { and, eq, getTableColumns, gt, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  accessTokens,
  billVotesHouse,
  billVotesPresidential,
  billVotesSenate,
  bills,
  feed,
  playerInvitations,
  users,
} from "@/db/schema";
import { db } from "@/db";
import { hashInvitationToken } from "@/lib/invitations/token";
import { avatarSchema, renderAvatar } from "@/lib/avatar";
import { UpdateUserProfileSchema } from "@/lib/schemas/user-schema";
import { SearchUsersSchema } from "@/lib/schemas/user-search-schema";
import { normalizeEmail, userEmailEquals } from "@/lib/server/user-email";
import { authMiddleware, requireAuthMiddleware } from "@/middleware";

const CreateUserSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
  email: z.string().email(),
  username: z.string().min(1, "Username is required"),
  bio: z.string().optional(),
  politicalLeaning: z.string().optional(),
  pronouns: z.string().trim().max(80, "Pronouns must be 80 characters or fewer").optional(),
});

export const validateAccessToken = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    const token = data.token.trim();
    if (token.startsWith("doi_")) {
      const invitation = await db
        .select({ id: playerInvitations.id })
        .from(playerInvitations)
        .where(
          and(
            eq(playerInvitations.tokenHash, hashInvitationToken(token)),
            isNull(playerInvitations.redeemedAt),
            isNull(playerInvitations.revokedAt),
            gt(playerInvitations.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (invitation.length === 0) {
        throw new Error("Invalid or already used invitation token");
      }

      return { valid: true };
    }

    const validToken = await db
      .select({ token: accessTokens.token })
      .from(accessTokens)
      .where(
        and(eq(accessTokens.token, token), isNull(accessTokens.redeemedAt)),
      )
      .limit(1);

    if (validToken.length === 0) {
      throw new Error("Invalid or already used invitation token");
    }

    return { valid: true };
  });

export const createUser = createServerFn({ method: "POST" })
  .inputValidator(CreateUserSchema)
  .handler(async ({ data }) => {
    const normalizedEmail = normalizeEmail(data.email);
    const accessToken = data.accessToken.trim();
    const existingUser = await db
      .select({ username: users.username, email: users.email })
      .from(users)
      .where(or(eq(users.username, data.username), userEmailEquals(data.email)))
      .limit(1);

    if (existingUser.some((user) => user.username === data.username)) {
      throw new Error("Username already exists");
    }

    if (
      existingUser.some(
        (user) => normalizeEmail(user.email) === normalizedEmail,
      )
    ) {
      throw new Error("Email already exists");
    }

    const [newUser] = await db.transaction(async (tx) => {
      const [redeemedToken] = accessToken.startsWith("doi_")
        ? await tx
          .update(playerInvitations)
          .set({ redeemedAt: new Date() })
          .where(
            and(
              eq(
                playerInvitations.tokenHash,
                hashInvitationToken(accessToken),
              ),
              isNull(playerInvitations.redeemedAt),
              isNull(playerInvitations.revokedAt),
              gt(playerInvitations.expiresAt, new Date()),
            ),
          )
          .returning({ id: playerInvitations.id })
        : await tx
          .update(accessTokens)
          .set({ redeemedAt: new Date() })
          .where(
            and(
              eq(accessTokens.token, accessToken),
              isNull(accessTokens.redeemedAt),
            ),
          )
          .returning({ id: accessTokens.id });

      if (!redeemedToken) {
        throw new Error("Invalid or already used invitation token");
      }

      const [newUser] = await tx
        .insert(users)
        .values({
          email: normalizedEmail,
          username: data.username,
          bio: data.bio || null,
          pronouns: data.pronouns?.trim() || null,
          politicalLeaning: data.politicalLeaning || null,
        })
        .returning();

      if (accessToken.startsWith("doi_")) {
        await tx
          .update(playerInvitations)
          .set({ redeemedByUserId: newUser.id })
          .where(eq(playerInvitations.id, redeemedToken.id));
      }

      const welcomeMessage = `has spawned into existence`;
      await tx.execute(sql`
        INSERT INTO feed (user_id, content, created_at)
        VALUES (${newUser.id}, ${welcomeMessage}, NOW())
      `);

      return [newUser];
    });

    return newUser;
  });

export const fetchUserInfo = createServerFn()
  .inputValidator((data: { userId: number }) => data)
  .handler(async ({ data }) => {
    const { email, ...userColumns } = getTableColumns(users);
    const user = await db
      .select(userColumns)
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);
    return user;
  });

export const fetchUserInfoByEmail = createServerFn()
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const { email, ...userColumns } = getTableColumns(users);
    const user = await db
      .select(userColumns)
      .from(users)
      .where(userEmailEquals(data.email))
      .limit(1);
    return user;
  });

export const getCurrentUserInfo = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user?.email) {
      return null;
    }
    const { email, ...userColumns } = getTableColumns(users);
    const user = await db
      .select(userColumns)
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);
    return user[0] ?? null;
  });

export const getAuthContext = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.user) {
      return { user: null, loading: false };
    }
    // Return a Firebase-compatible user object for the router context
    return {
      user: {
        uid: context.user.uid,
        email: context.user.email ?? null,
        emailVerified: false,
        isAnonymous: false,
        metadata: {},
        providerData: [],
        refreshToken: "",
        tenantId: null,
        displayName: null,
        phoneNumber: null,
        photoURL: null,
        providerId: "firebase",
      },
      loading: false,
    };
  });

export const getUserFullById = createServerFn()
  .inputValidator((data: { userId: number; checkActive?: boolean }) => data)
  .handler(async ({ data }) => {
    const { email, ...userColumns } = getTableColumns(users);
    const user = await db
      .select(userColumns)
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);

    if (user.length === 0) {
      throw new Error("User not found");
    }

    const userData = user[0];

    if (data.checkActive && !userData.isActive) {
      throw new Error("Profile not available");
    }

    return userData;
  });

export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(UpdateUserProfileSchema)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) {
      throw new Error("User email not found in context");
    }

    const [currentUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(userEmailEquals(context.user.email))
      .limit(1);

    if (currentUser.id !== data.userId) {
      throw new Error("You can only update your own profile");
    }

    const updatedUser = await db
      .update(users)
      .set({
        username: data.username,
        bio: data.bio,
        pronouns: data.pronouns?.trim() || null,
        politicalLeaning: data.politicalLeaning,
      })
      .where(eq(users.id, data.userId))
      .returning();

    if (updatedUser.length === 0) {
      throw new Error("Failed to update user profile");
    }

    await db.insert(feed).values({
      userId: updatedUser[0].id,
      content: "updated their player profile",
    });

    return updatedUser[0];
  });

export const updatePlayerAvatar = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(avatarSchema)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const [player] = await db
      .update(users)
      .set({ avatarConfig: data, photoUrl: renderAvatar(data) })
      .where(userEmailEquals(context.user.email))
      .returning({ id: users.id });
    if (!player) throw new Error("Player account not found");
    return { saved: true };
  });

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
      .where(eq(billVotesHouse.voterId, data.userId));

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
      .where(eq(billVotesSenate.voterId, data.userId));

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
      .where(eq(billVotesPresidential.voterId, data.userId));

    // Combine all votes and sort by ID
    const allVotes = [...houseVotes, ...senateVotes, ...presidentialVotes].sort(
      (a, b) => b.id - a.id,
    );

    return allVotes;
  });

export const searchUsers = createServerFn()
  .inputValidator((data: unknown) => SearchUsersSchema.parse(data))
  .handler(async ({ data }) => {
    const { q, excludeUserId } = data;

    if (!q || q.trim() === "") {
      return { users: [] };
    }

    try {
      const results = await db
        .select({
          id: users.id,
          username: users.username,
          bio: users.bio,
          politicalLeaning: users.politicalLeaning,
          role: users.role,
          photoUrl: users.photoUrl,
          partyId: users.partyId,
          createdAt: users.createdAt,
          lastActivity: users.lastActivity,
        })
        .from(users)
        .where(
          sql`${users.username} ILIKE ${"%" + q + "%"}
              AND ${users.username} NOT LIKE 'Banned User%'
              ${excludeUserId ? sql`AND ${users.id} != ${excludeUserId}` : sql``}`,
        )
        .orderBy(users.username)
        .limit(50);

      return { users: results };
    } catch (error) {
      console.error("Error searching users:", error);
      throw new Error("Failed to search users");
    }
  });

export const getUserStats = createServerFn().handler(async () => {
  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active_users
      FROM users
      WHERE username NOT LIKE 'Banned User%'
    `);

    return result.rows[0] as Record<string, string>;
  } catch (error) {
    console.error("Error fetching user stats:", error);
    throw new Error("Failed to fetch user stats");
  }
});
