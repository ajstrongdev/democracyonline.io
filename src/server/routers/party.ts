import 'server-only';

import { router, publicProcedure, authedProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const partyRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const res = await ctx.query('SELECT * FROM parties');
    return res.rows;
  }),

  getById: publicProcedure
    .input(z.object({ partyId: z.number() }))
    .query(async ({ input, ctx }) => {
      const partyRes = await ctx.query('SELECT * FROM parties WHERE id = $1', [
        input.partyId,
      ]);
      if (partyRes.rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Party not found' });
      }
      const party = partyRes.rows[0];
      const stancesRes = await ctx.query(
        `SELECT ps.issue, pst.value, ps.id
         FROM party_stances pst
         JOIN political_stances ps ON pst.stance_id = ps.id
         WHERE pst.party_id = $1
         ORDER BY ps.id`,
        [input.partyId],
      );
      return { ...party, stances: stancesRes.rows };
    }),

  members: publicProcedure
    .input(z.object({ partyId: z.number() }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        "SELECT id, username, bio, political_leaning, role, party_id, created_at FROM users WHERE party_id = $1 AND username NOT LIKE 'Banned User%'",
        [input.partyId],
      );
      return res.rows;
    }),

  checkMembership: publicProcedure
    .input(z.object({ userId: z.number(), partyId: z.number() }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query('SELECT 1 FROM users WHERE id = $1 AND party_id = $2', [input.userId, input.partyId]);
      return res.rows.length > 0;
    }),

  leaderboard: publicProcedure.query(async ({ ctx }) => {
    const res = await ctx.query(`
    SELECT
      p.*,
      COUNT(u.id)::int AS member_count
    FROM parties p
    LEFT JOIN users u ON u.party_id = p.id
    GROUP BY p.id
    ORDER BY member_count DESC
  `);
    return res.rows.map((row: any) => ({
      party: {
        id: row.id,
        name: row.name,
        color: row.color,
        bio: row.bio,
        leaning: row.leaning ?? row.political_leaning,
        manifesto_url: row.manifesto_url ?? null,
        leader_id: row.leader_id,
        created_at: row.created_at,
        logo: row.logo ?? null,
        discord: row.discord ?? null,
      },
      memberCount: row.member_count,
    }));
  }),

  stanceTypes: publicProcedure.query(async ({ ctx }) => {
    const res = await ctx.query(
      'SELECT id, issue, description FROM political_stances ORDER BY id ASC'
    );
    return res.rows;
  }),

  create: authedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        color: z.string().regex(/^#[0-9A-F]{6}$/i),
        bio: z.string().min(1),
        leaning: z.string().min(1),
        logo: z.string().nullable(),
        stanceValues: z.array(z.object({ id: z.number(), value: z.string() })),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const partyRes = await ctx.query(
        `INSERT INTO parties (leader_id, name, color, bio, leaning, logo)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [ctx.dbUserId, input.name, input.color, input.bio, input.leaning, input.logo],
      );
      const partyId = partyRes.rows[0].id;
      await ctx.query('UPDATE users SET party_id = $1 WHERE id = $2', [
        partyId,
        ctx.dbUserId,
      ]);
      for (const stance of input.stanceValues) {
        await ctx.query(
          'INSERT INTO party_stances (party_id, stance_id, value) VALUES ($1, $2, $3)',
          [partyId, stance.id, stance.value],
        );
      }
      return partyRes.rows[0];
    }),

  update: authedProcedure
    .input(
      z.object({
        partyId: z.number(),
        name: z.string().min(1),
        color: z.string().regex(/^#[0-9A-F]{6}$/i),
        bio: z.string().min(1),
        leaning: z.string().min(1),
        logo: z.string().nullable(),
        stanceValues: z.array(z.object({ id: z.number(), value: z.string() })),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const partyRes = await ctx.query(
        'SELECT leader_id FROM parties WHERE id = $1',
        [input.partyId],
      );
      if (partyRes.rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Party not found' });
      }
      if (Number(partyRes.rows[0].leader_id) !== ctx.dbUserId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Leader only' });
      }
      const updateRes = await ctx.query(
        'UPDATE parties SET name = $1, color = $2, bio = $3, leaning = $4, logo = $5 WHERE id = $6 RETURNING *',
        [input.name, input.color, input.bio, input.leaning, input.logo, input.partyId],
      );
      for (const stance of input.stanceValues) {
        await ctx.query(
          'UPDATE party_stances SET value = $1 WHERE party_id = $2 AND stance_id = $3',
          [stance.value, input.partyId, stance.id],
        );
      }
      return updateRes.rows[0];
    }),

  join: authedProcedure
    .input(z.object({ partyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const res = await ctx.query(
        'UPDATE users SET party_id = $1 WHERE id = $2 RETURNING *',
        [input.partyId, ctx.dbUserId],
      );
      if (res.rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      return res.rows[0];
    }),

  leave: authedProcedure
    .input(z.object({}))
    .mutation(async ({ ctx }) => {
      // Clear leadership if currently leader of any party
      await ctx.query('UPDATE parties SET leader_id = NULL WHERE leader_id = $1', [
        ctx.dbUserId,
      ]);
      const res = await ctx.query(
        'UPDATE users SET party_id = NULL WHERE id = $1 RETURNING *',
        [ctx.dbUserId],
      );

      // Delete parties with zero members
      const emptyRes = await ctx.query(`
        SELECT p.id FROM parties p
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.party_id = p.id)
      `);
      for (const party of emptyRes.rows) {
        await ctx.query('DELETE FROM party_stances WHERE party_id = $1', [
          party.id,
        ]);
        await ctx.query('DELETE FROM parties WHERE id = $1', [party.id]);
      }

      return res.rows[0];
    }),

  kick: authedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Only leader of the member's party can kick them
      const memberRes = await ctx.query(
        'SELECT party_id FROM users WHERE id = $1',
        [input.userId],
      );
      const partyId = memberRes.rows[0]?.party_id ?? null;
      if (!partyId) {
        return { success: true }; // already not in a party
      }
      const leaderRes = await ctx.query(
        'SELECT leader_id FROM parties WHERE id = $1',
        [partyId],
      );
      if (Number(leaderRes.rows[0]?.leader_id) !== ctx.dbUserId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Leader only' });
      }
      await ctx.query('UPDATE users SET party_id = NULL WHERE id = $1', [
        input.userId,
      ]);
      return { success: true };
    }),

  becomeLeader: authedProcedure
    .input(z.object({ partyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const memberRes = await ctx.query(
        'SELECT 1 FROM users WHERE id = $1 AND party_id = $2',
        [ctx.dbUserId, input.partyId],
      );
      if (memberRes.rows.length === 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Must be party member to become leader',
        });
      }
      const res = await ctx.query(
        'UPDATE parties SET leader_id = $1 WHERE id = $2 RETURNING *',
        [ctx.dbUserId, input.partyId],
      );
      return res.rows[0];
    }),

  // Merge requests (create, list incoming/sent, accept, reject)
  mergeCreate: authedProcedure
    .input(
      z.object({
        senderPartyId: z.number(),
        receiverPartyId: z.number(),
        mergedPartyData: z.object({
          name: z.string().min(1),
          color: z.string().regex(/^#[0-9A-F]{6}$/i),
          bio: z.string().min(1),
          leaning: z.string().min(1),
          logo: z.string().nullable(),
          stanceValues: z
            .array(z.object({ id: z.number(), value: z.string() }))
            .optional(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Ensure requester is leader of sender party
      const leaderRes = await ctx.query(
        'SELECT leader_id FROM parties WHERE id = $1',
        [input.senderPartyId],
      );
      if (Number(leaderRes.rows[0]?.leader_id) !== ctx.dbUserId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Leader only' });
      }

      const existing = await ctx.query(
        `SELECT 1 FROM party_notifications
         WHERE sender_party_id = $1 AND receiver_party_id = $2 AND status = 'Pending'`,
        [input.senderPartyId, input.receiverPartyId],
      );
      if (existing.rows.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Pending request already exists',
        });
      }

      const mr = await ctx.query(
        `INSERT INTO merge_request (name, color, bio, political_leaning, leaning, logo)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          input.mergedPartyData.name,
          input.mergedPartyData.color,
          input.mergedPartyData.bio,
          input.mergedPartyData.leaning,
          input.mergedPartyData.leaning,
          input.mergedPartyData.logo,
        ],
      );
      const mergeRequestId = mr.rows[0].id;

      if (input.mergedPartyData.stanceValues?.length) {
        for (const s of input.mergedPartyData.stanceValues) {
          if (s.value) {
            await ctx.query(
              `INSERT INTO merge_request_stances (merge_request_id, stance_id, value)
               VALUES ($1, $2, $3)`,
              [mergeRequestId, s.id, s.value],
            );
          }
        }
      }

      await ctx.query(
        `INSERT INTO party_notifications
         (sender_party_id, receiver_party_id, merge_request_id, status)
         VALUES ($1, $2, $3, 'Pending')`,
        [input.senderPartyId, input.receiverPartyId, mergeRequestId],
      );

      return { success: true, mergeRequestId };
    }),

  mergeListIncoming: authedProcedure
    .input(z.object({ partyId: z.number() }))
    .query(async ({ input, ctx }) => {
      // Ensure requester is leader of receiver party (for visibility you could relax this)
      const leaderRes = await ctx.query(
        'SELECT leader_id FROM parties WHERE id = $1',
        [input.partyId],
      );
      if (Number(leaderRes.rows[0]?.leader_id) !== ctx.dbUserId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Leader only' });
      }

      const mergeRequests = await ctx.query(
        `SELECT 
          pn.merge_request_id, pn.sender_party_id, pn.receiver_party_id, pn.status, pn.created_at,
          mr.id, mr.name, mr.color, mr.bio, mr.political_leaning, mr.leaning, mr.logo,
          sp.name as sender_party_name, sp.color as sender_party_color
         FROM party_notifications pn
         JOIN merge_request mr ON pn.merge_request_id = mr.id
         JOIN parties sp ON pn.sender_party_id = sp.id
         WHERE pn.receiver_party_id = $1 AND pn.status = 'Pending'
         ORDER BY pn.created_at DESC`,
        [input.partyId],
      );

      const withStances = [];
      for (const r of mergeRequests.rows) {
        const st = await ctx.query(
          `SELECT mrs.value, st.issue, st.description
           FROM merge_request_stances mrs
           JOIN political_stances st ON mrs.stance_id = st.id
           WHERE mrs.merge_request_id = $1`,
          [r.id],
        );
        withStances.push({
          id: r.merge_request_id,
          mergeData: {
            name: r.name,
            color: r.color,
            bio: r.bio,
            leaning: r.leaning,
            logo: r.logo,
            stances: st.rows,
          },
          senderParty: {
            id: r.sender_party_id,
            name: r.sender_party_name,
            color: r.sender_party_color,
          },
          status: r.status,
          createdAt: r.created_at,
        });
      }
      return withStances;
    }),

  mergeListSent: authedProcedure
    .input(z.object({ partyId: z.number() }))
    .query(async ({ input, ctx }) => {
      // Ensure requester is leader of sender party
      const leaderRes = await ctx.query(
        'SELECT leader_id FROM parties WHERE id = $1',
        [input.partyId],
      );
      if (Number(leaderRes.rows[0]?.leader_id) !== ctx.dbUserId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Leader only' });
      }

      const mergeRequests = await ctx.query(
        `SELECT 
          pn.merge_request_id, pn.sender_party_id, pn.receiver_party_id, pn.status, pn.created_at,
          mr.id, mr.name, mr.color, mr.bio, mr.political_leaning, mr.leaning, mr.logo,
          rp.name as receiver_party_name, rp.color as receiver_party_color
         FROM party_notifications pn
         JOIN merge_request mr ON pn.merge_request_id = mr.id
         JOIN parties rp ON pn.receiver_party_id = rp.id
         WHERE pn.sender_party_id = $1 AND pn.status = 'Pending'
         ORDER BY pn.created_at DESC`,
        [input.partyId],
      );

      const withStances = [];
      for (const r of mergeRequests.rows) {
        const st = await ctx.query(
          `SELECT mrs.value, st.issue, st.description
           FROM merge_request_stances mrs
           JOIN political_stances st ON mrs.stance_id = st.id
           WHERE mrs.merge_request_id = $1`,
          [r.id],
        );
        withStances.push({
          id: r.merge_request_id,
          mergeData: {
            name: r.name,
            color: r.color,
            bio: r.bio,
            leaning: r.leaning,
            logo: r.logo,
            stances: st.rows,
          },
          receiverParty: {
            id: r.receiver_party_id,
            name: r.receiver_party_name,
            color: r.receiver_party_color,
          },
          status: r.status,
          createdAt: r.created_at,
        });
      }
      return withStances;
    }),

  mergeAccept: authedProcedure
    .input(z.object({ mergeRequestId: z.number(), partyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Ensure requester is leader of receiver party
      const leaderRes = await ctx.query(
        'SELECT leader_id FROM parties WHERE id = $1',
        [input.partyId],
      );
      if (Number(leaderRes.rows[0]?.leader_id) !== ctx.dbUserId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Leader only' });
      }

      const notification = await ctx.query(
        `SELECT * FROM party_notifications 
         WHERE merge_request_id = $1 AND receiver_party_id = $2 AND status = 'Pending'`,
        [input.mergeRequestId, input.partyId],
      );
      if (notification.rows.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Merge request not found or processed',
        });
      }
      const { sender_party_id, receiver_party_id } = notification.rows[0];

      // Fetch merge data and stances
      const mergeRequest = await ctx.query(
        'SELECT * FROM merge_request WHERE id = $1',
        [input.mergeRequestId],
      );
      if (mergeRequest.rows.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Merge data not found',
        });
      }
      const mergeData = mergeRequest.rows[0];
      const mergeStances = await ctx.query(
        'SELECT stance_id, value FROM merge_request_stances WHERE merge_request_id = $1',
        [input.mergeRequestId],
      );

      await ctx.query('BEGIN');
      try {
        // New merged party
        const newParty = await ctx.query(
          `INSERT INTO parties (name, color, bio, political_leaning, leaning, logo, leader_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
          [
            mergeData.name,
            mergeData.color,
            mergeData.bio,
            mergeData.political_leaning,
            mergeData.leaning,
            mergeData.logo,
            ctx.dbUserId, // make receiver leader leader by default
          ],
        );
        const newPartyId = newParty.rows[0].id;

        for (const s of mergeStances.rows) {
          await ctx.query(
            'INSERT INTO party_stances (party_id, stance_id, value) VALUES ($1, $2, $3)',
            [newPartyId, s.stance_id, s.value],
          );
        }

        // Move users from both parties
        await ctx.query(
          'UPDATE users SET party_id = $1 WHERE party_id IN ($2, $3)',
          [newPartyId, sender_party_id, receiver_party_id],
        );

        // Cleanup old parties
        await ctx.query('DELETE FROM party_stances WHERE party_id IN ($1, $2)', [
          sender_party_id,
          receiver_party_id,
        ]);
        await ctx.query('DELETE FROM parties WHERE id IN ($1, $2)', [
          sender_party_id,
          receiver_party_id,
        ]);

        // Mark request accepted
        await ctx.query(
          `UPDATE party_notifications SET status = 'Accepted' WHERE merge_request_id = $1`,
          [input.mergeRequestId],
        );

        await ctx.query('COMMIT');
        return { success: true, newPartyId };
      } catch (e) {
        await ctx.query('ROLLBACK');
        throw e;
      }
    }),

  mergeReject: authedProcedure
    .input(z.object({ mergeRequestId: z.number(), partyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Ensure requester is leader of receiver party
      const leaderRes = await ctx.query(
        'SELECT leader_id FROM parties WHERE id = $1',
        [input.partyId],
      );
      if (Number(leaderRes.rows[0]?.leader_id) !== ctx.dbUserId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Leader only' });
      }

      const notification = await ctx.query(
        `SELECT 1 FROM party_notifications
         WHERE merge_request_id = $1 AND receiver_party_id = $2 AND status = 'Pending'`,
        [input.mergeRequestId, input.partyId],
      );
      if (notification.rows.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Merge request not found or processed',
        });
      }

      await ctx.query(
        `UPDATE party_notifications SET status = 'Rejected' WHERE merge_request_id = $1`,
        [input.mergeRequestId],
      );
      return { success: true };
    }),
});
