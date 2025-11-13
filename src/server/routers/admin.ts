import 'server-only';

import { router, adminProcedure } from '@/server/trpc';
import { z } from 'zod';
import { adminAuth } from '@/lib/firebase-admin';
import crypto from 'crypto';
import { TRPCError } from '@trpc/server';

function generateUrlSafeToken(bytes = 32) {
  const raw = crypto.randomBytes(bytes).toString('base64');
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function getAdminEmailsFromEnv(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const adminEmailsSet = () => new Set(getAdminEmailsFromEnv());

export const adminRouter = router({
  verify: adminProcedure.query(() => {
    return { isAdmin: true };
  }),

  // Optional: let the client ask which emails are admins for display
  checkAdminsByEmail: adminProcedure
    .input(z.object({ emails: z.array(z.email()) }))
    .query(({ input }) => {
      const set = adminEmailsSet();
      const out: Record<string, boolean> = {};
      for (const e of input.emails) {
        out[e.toLowerCase()] = set.has(e.toLowerCase());
      }
      return out;
    }),

  listUsers: adminProcedure.query(async ({ ctx }) => {
    const res = await ctx.query(
      'SELECT id, email, username, role, party_id, created_at FROM users ORDER BY created_at DESC',
    );

    // Enrich with Firebase auth data by email lookup
    const enriched = await Promise.all(
      res.rows.map(async (row) => {
        try {
          // Get Firebase user by email
          const authUser = row.email
            ? await adminAuth.getUserByEmail(row.email)
            : null;

          if (!authUser) {
            return {
              // Database fields
              id: row.id,
              email: row.email,
              username: row.username,
              role: row.role,
              party_id: row.party_id,
              created_at: row.created_at,
              // Firebase fields (defaults)
              uid: String(row.id),
              disabled: false,
              emailVerified: false,
            };
          }

          return {
            // Database fields
            id: row.id,
            email: row.email,
            username: row.username,
            role: row.role,
            party_id: row.party_id,
            created_at: row.created_at,
            // Firebase fields
            uid: authUser.uid,
            displayName: authUser.displayName ?? undefined,
            photoURL: authUser.photoURL ?? undefined,
            disabled: authUser.disabled,
            emailVerified: authUser.emailVerified,
            creationTime: authUser.metadata.creationTime,
            lastSignInTime: authUser.metadata.lastSignInTime,
          };
        } catch {
          // User not in Firebase; return DB data only
          return {
            id: row.id,
            email: row.email,
            username: row.username,
            role: row.role,
            party_id: row.party_id,
            created_at: row.created_at,
            uid: String(row.id),
            disabled: false,
            emailVerified: false,
          };
        }
      })
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
      // Server-side admin protection
      let isTargetAdmin = false;
      if (input.email) {
        isTargetAdmin = adminEmailsSet().has(input.email.toLowerCase());
      }
      if (!isTargetAdmin) {
        // Fall back to checking by uid
        try {
          const user = await adminAuth.getUser(input.uid);
          const email = user.email?.toLowerCase();
          isTargetAdmin = !!email && adminEmailsSet().has(email);
        } catch {
          // user not found -> not admin; continue
        }
      }
      if (isTargetAdmin && input.disabled) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot disable admin accounts' });
      }
      await adminAuth.updateUser(input.uid, { disabled: input.disabled });
      return { success: true, uid: input.uid, disabled: input.disabled };
    }),

  purgeUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.query('BEGIN');
      try {
        await ctx.query('DELETE FROM bill_votes_house WHERE voter_id = $1', [input.userId]);
        await ctx.query('DELETE FROM bill_votes_senate WHERE voter_id = $1', [input.userId]);
        await ctx.query('DELETE FROM bill_votes_presidential WHERE voter_id = $1', [input.userId]);
        await ctx.query('DELETE FROM votes WHERE user_id = $1', [input.userId]);
        await ctx.query('DELETE FROM candidates WHERE user_id = $1', [input.userId]);
        await ctx.query('UPDATE bills SET creator_id = NULL WHERE creator_id = $1', [input.userId]);
        await ctx.query('DELETE FROM feed WHERE user_id = $1', [input.userId]);
        await ctx.query('DELETE FROM chats WHERE user_id = $1', [input.userId]);
        await ctx.query('UPDATE parties SET leader_id = NULL WHERE leader_id = $1', [input.userId]);
        await ctx.query('UPDATE users SET party_id = NULL WHERE id = $1', [input.userId]);
        const res = await ctx.query('DELETE FROM users WHERE id = $1 RETURNING id', [input.userId]);
        await ctx.query('COMMIT');
        return { success: !!res.rowCount };
      } catch (e) {
        await ctx.query('ROLLBACK');
        throw e;
      }
    }),

  listParties: adminProcedure.query(async ({ ctx }) => {
    const res = await ctx.query(`
      SELECT
        p.*,
        COUNT(u.id) as member_count,
        u_leader.username as leader_username
      FROM parties p
      LEFT JOIN users u ON u.party_id = p.id
      LEFT JOIN users u_leader ON u_leader.id = p.leader_id
      GROUP BY p.id, u_leader.username
      ORDER BY p.created_at DESC
    `);
    return res.rows;
  }),

  deleteParty: adminProcedure
    .input(z.object({ partyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.query('DELETE FROM party_stances WHERE party_id = $1', [
        input.partyId,
      ]);
      await ctx.query('UPDATE users SET party_id = NULL WHERE party_id = $1', [
        input.partyId,
      ]);
      await ctx.query('DELETE FROM parties WHERE id = $1', [input.partyId]);
      return { success: true };
    }),

  accessTokensList: adminProcedure.query(async ({ ctx }) => {
    const result = await ctx.query(
      'SELECT id, token, created_at FROM access_tokens ORDER BY created_at DESC',
    );
    return result.rows as Array<{ id: number; token: string; created_at: string }>;
  }),

  accessTokenCreate: adminProcedure.mutation(async ({ ctx }) => {
    const token = generateUrlSafeToken(32);
    const result = await ctx.query(
      'INSERT INTO access_tokens (token) VALUES ($1) RETURNING id, token, created_at',
      [token],
    );
    return result.rows[0] as { id: number; token: string; created_at: string };
  }),

  accessTokenDelete: adminProcedure
    .input(z.object({ tokenId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.query('DELETE FROM access_tokens WHERE id = $1', [input.tokenId]);
      return { success: true };
    }),
});
