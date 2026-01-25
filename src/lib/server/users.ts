import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { eq, getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";
import {
  accessTokens,
  billVotesHouse,
  billVotesPresidential,
  billVotesSenate,
  bills,
  users,
} from "@/db/schema";
import { db } from "@/db";
import { getAdminAuth } from "@/lib/firebase-admin";
import { UpdateUserProfileSchema } from "@/lib/schemas/user-schema";
import { SearchUsersSchema } from "@/lib/schemas/user-search-schema";
import { authMiddleware, requireAuthMiddleware } from "@/middleware";

const CreateUserSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
  email: z.string().email(),
  username: z.string().min(1, "Username is required"),
  bio: z.string().optional(),
  politicalLeaning: z.string().optional(),
});

export const validateAccessToken = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    const validToken = await db
      .select({ token: accessTokens.token })
      .from(accessTokens)
      .where(eq(accessTokens.token, data.token))
      .limit(1);

    if (validToken.length === 0) {
      throw new Error("Invalid access token");
    }

    return { valid: true };
  });

export const createUser = createServerFn({ method: "POST" })
  .inputValidator(CreateUserSchema)
  .handler(async ({ data }) => {
    const existingUser = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.username, data.username))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error("Username already exists");
    }

    const [newUser] = await db
      .insert(users)
      .values({
        email: data.email,
        username: data.username,
        bio: data.bio || null,
        politicalLeaning: data.politicalLeaning || null,
      })
      .returning();

    const welcomeMessage = `has spawned into existence`;
    await db.execute(sql`
      INSERT INTO feed (user_id, message, created_at)
      VALUES (${newUser.id}, ${welcomeMessage}, NOW())
    `);

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
      .where(eq(users.email, data.email))
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
      .where(eq(users.email, context.user.email))
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
      .where(eq(users.email, context.user.email))
      .limit(1);

    if (!currentUser || currentUser.id !== data.userId) {
      throw new Error("You can only update your own profile");
    }

    const updatedUser = await db
      .update(users)
      .set({
        username: data.username,
        bio: data.bio,
        politicalLeaning: data.politicalLeaning,
      })
      .where(eq(users.id, data.userId))
      .returning();

    if (updatedUser.length === 0) {
      throw new Error("Failed to update user profile");
    }

    return updatedUser[0];
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

export const createSessionCookie = createServerFn({ method: "POST" })
  .inputValidator(z.object({ idToken: z.string() }))
  .handler(async ({ data }) => {
    try {
      const expiresIn = 60 * 60 * 24 * 5 * 1000;
      const sessionCookie = await getAdminAuth().createSessionCookie(
        data.idToken,
        { expiresIn },
      );

      setCookie("__session", sessionCookie, {
        maxAge: expiresIn / 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      return { success: true };
    } catch (error) {
      console.error("Error creating session cookie:", error);
      throw new Error("Failed to create session");
    }
  });

export const deleteSessionCookie = createServerFn({ method: "POST" }).handler(
  async () => {
    // Delete the session cookie
    setCookie("__session", "", {
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return { success: true };
  },
);
