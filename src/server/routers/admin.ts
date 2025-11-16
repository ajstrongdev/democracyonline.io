import "server-only";

import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminAuth } from "@/lib/firebase-admin";
import {
  AdminAccessTokenSchema,
  AdminCheckByEmailSchema,
  AdminPartySchema,
  AdminUserEnrichedSchema,
  AdminVerifySchema,
  SuccessSchema,
} from "@/lib/trpc/types";
import { adminProcedure, router } from "@/server/trpc";

function generateUrlSafeToken(bytes = 32) {
  const raw = crypto.randomBytes(bytes).toString("base64");
  return raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getAdminEmailsFromEnv(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const adminEmailsSet = () => new Set(getAdminEmailsFromEnv());

export const adminRouter = router({
  verify: adminProcedure.query(() => {
    return AdminVerifySchema.parse({});
  }),

  checkAdminsByEmail: adminProcedure
    .input(z.object({ emails: z.array(z.email()) }))
    .query(({ input }) => {
      const set = adminEmailsSet();
      const out: Record<string, boolean> = {};
      for (const e of input.emails) {
        out[e.toLowerCase()] = set.has(e.toLowerCase());
      }
      return AdminCheckByEmailSchema.parse(out);
    }),

  listUsers: adminProcedure.query(async ({ ctx }) => {
    const res = await ctx.query(
      "SELECT id, email, username, role, party_id, created_at FROM users ORDER BY created_at DESC",
    );

    const enriched = await Promise.all(
      res.rows.map(
        async (row): Promise<z.infer<typeof AdminUserEnrichedSchema>> => {
          const base = {
            id: row.id,
            email: row.email ?? undefined,
            username: row.username,
            role: row.role ?? null,
            party_id: row.partyId ?? null,
            created_at: row.createdAt,
          };

          try {
            const authUser = row.email
              ? await adminAuth.getUserByEmail(row.email)
              : null;

            const candidate = authUser
              ? {
                  ...base,
                  uid: authUser.uid,
                  displayName: authUser.displayName ?? undefined,
                  photoUrl: authUser.photoURL ?? undefined,
                  disabled: authUser.disabled,
                  emailVerified: authUser.emailVerified,
                  creationTime: authUser.metadata.creationTime,
                  lastSignInTime: authUser.metadata.lastSignInTime,
                }
              : {
                  ...base,
                  uid: String(base.id),
                  disabled: false,
                  emailVerified: false,
                };

            return AdminUserEnrichedSchema.parse(candidate);
          } catch {
            return AdminUserEnrichedSchema.parse({
              ...base,
              uid: String(base.id),
              disabled: false,
              emailVerified: false,
            });
          }
        },
      ),
    );

    return enriched;
  }),

  toggleUserStatus: adminProcedure
    .input(
      z.object({
        uid: z.string(),
        disabled: z.boolean(),
        email: z.email().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      let isTargetAdmin = false;
      if (input.email) {
        isTargetAdmin = adminEmailsSet().has(input.email.toLowerCase());
      }
      if (!isTargetAdmin) {
        try {
          const user = await adminAuth.getUser(input.uid);
          const email = user.email?.toLowerCase();
          isTargetAdmin = !!email && adminEmailsSet().has(email);
        } catch {
          // ignore lookup errors
        }
      }
      if (isTargetAdmin && input.disabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot disable admin accounts",
        });
      }
      await adminAuth.updateUser(input.uid, { disabled: input.disabled });
      return z
        .object({
          success: z.boolean(),
          uid: z.string(),
          disabled: z.boolean(),
        })
        .parse({ success: true, uid: input.uid, disabled: input.disabled });
    }),

  purgeUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.query("BEGIN");
      try {
        await ctx.query("DELETE FROM bill_votes_house WHERE voter_id = $1", [
          input.userId,
        ]);
        await ctx.query("DELETE FROM bill_votes_senate WHERE voter_id = $1", [
          input.userId,
        ]);
        await ctx.query(
          "DELETE FROM bill_votes_presidential WHERE voter_id = $1",
          [input.userId],
        );
        await ctx.query("DELETE FROM votes WHERE user_id = $1", [input.userId]);
        await ctx.query("DELETE FROM candidates WHERE user_id = $1", [
          input.userId,
        ]);
        await ctx.query(
          "UPDATE bills SET creator_id = NULL WHERE creator_id = $1",
          [input.userId],
        );
        await ctx.query("DELETE FROM feed WHERE user_id = $1", [input.userId]);
        await ctx.query("DELETE FROM chats WHERE user_id = $1", [input.userId]);
        await ctx.query(
          "UPDATE parties SET leader_id = NULL WHERE leader_id = $1",
          [input.userId],
        );
        await ctx.query("UPDATE users SET party_id = NULL WHERE id = $1", [
          input.userId,
        ]);
        const res = await ctx.query(
          "DELETE FROM users WHERE id = $1 RETURNING id",
          [input.userId],
        );
        await ctx.query("COMMIT");

        return SuccessSchema.parse({ success: !!res.rowCount });
      } catch (e) {
        await ctx.query("ROLLBACK");
        throw e;
      }
    }),

  listParties: adminProcedure.query(async ({ ctx }) => {
    const res = await ctx.query(`
      SELECT
        p.id,
        p.name,
        p.color,
        p.bio AS description,
        p.leader_id,
        p.created_at,
        COUNT(u.id)::int as member_count,
        u_leader.username as leader_username
      FROM parties p
      LEFT JOIN users u ON u.party_id = p.id
      LEFT JOIN users u_leader ON u_leader.id = p.leader_id
      GROUP BY p.id, u_leader.username
      ORDER BY p.created_at DESC
    `);

    return z.array(AdminPartySchema).parse(res.rows);
  }),

  deleteParty: adminProcedure
    .input(z.object({ partyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.query("DELETE FROM party_stances WHERE party_id = $1", [
        input.partyId,
      ]);

      await ctx.query("UPDATE users SET party_id = NULL WHERE party_id = $1", [
        input.partyId,
      ]);

      await ctx.query("DELETE FROM parties WHERE id = $1", [input.partyId]);

      return SuccessSchema.parse({});
    }),

  accessTokensList: adminProcedure.query(async ({ ctx }) => {
    const result = await ctx.query(
      "SELECT id, token, created_at FROM access_tokens ORDER BY created_at DESC",
    );

    return z.array(AdminAccessTokenSchema).parse(result.rows);
  }),

  accessTokenCreate: adminProcedure.mutation(async ({ ctx }) => {
    const token = generateUrlSafeToken(32);
    const result = await ctx.query(
      "INSERT INTO access_tokens (token) VALUES ($1) RETURNING id, token, created_at",
      [token],
    );

    return AdminAccessTokenSchema.parse(result.rows[0]);
  }),

  accessTokenDelete: adminProcedure
    .input(z.object({ tokenId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.query("DELETE FROM access_tokens WHERE id = $1", [
        input.tokenId,
      ]);
      return SuccessSchema.parse({});
    }),
});
