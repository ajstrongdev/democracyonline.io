import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  LeaderboardSchema,
  MergeAcceptSchema,
  MergeIncomingSchema,
  MergeRequestCreateSchema,
  MergeSentSchema,
  MergeStanceSchema,
  PartySchema,
  PartyWithStancesSchema,
  StanceTypeSchema,
  SuccessSchema,
  UserSchema,
} from "@/lib/trpc/types";
import { authedProcedure, publicProcedure, router } from "@/server/trpc";

const BANNED_USER_PREFIX = "Banned User%";

export const partyRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const res = await ctx.query("SELECT * FROM parties");
    return z.array(PartySchema).parse(res.rows);
  }),

  getById: publicProcedure
    .input(z.object({ partyId: z.number() }))
    .query(async ({ input, ctx }) => {
      const partyRes = await ctx.query("SELECT * FROM parties WHERE id = $1", [
        input.partyId,
      ]);
      if (partyRes.rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Party not found" });
      }

      const stancesRes = await ctx.query(
        `SELECT ps.id, ps.issue, pst.value
         FROM party_stances pst
         JOIN political_stances ps ON pst.stance_id = ps.id
         WHERE pst.party_id = $1
         ORDER BY ps.id`,
        [input.partyId],
      );

      const party = PartySchema.parse(partyRes.rows[0]);
      const stances = stancesRes.rows.map((s) => ({
        id: s.id,
        issue: s.issue,
        value: s.value,
      }));

      return PartyWithStancesSchema.parse({ ...party, stances });
    }),

  members: publicProcedure
    .input(z.object({ partyId: z.number() }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        `SELECT id, email, username, bio, political_leaning, role, party_id, created_at 
         FROM users 
         WHERE party_id = $1 AND username NOT LIKE $2`,
        [input.partyId, BANNED_USER_PREFIX],
      );

      return z.array(UserSchema).parse(res.rows);
    }),

  checkMembership: publicProcedure
    .input(z.object({ userId: z.number(), partyId: z.number() }))
    .query(async ({ input, ctx }) => {
      const res = await ctx.query(
        "SELECT 1 FROM users WHERE id = $1 AND party_id = $2",
        [input.userId, input.partyId],
      );

      return z.boolean().parse(res.rows.length > 0);
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

    const parsed = z
      .array(
        z.object({
          memberCount: z.number(),
        }),
      )
      .parse(res.rows);

    const leaderboard = res.rows.map((row, index) => ({
      party: PartySchema.parse(row),
      memberCount: parsed[index].memberCount,
    }));

    return LeaderboardSchema.parse(leaderboard);
  }),

  stanceTypes: publicProcedure.query(async ({ ctx }) => {
    const res = await ctx.query(
      "SELECT id, issue, description FROM political_stances ORDER BY id ASC",
    );

    return z.array(StanceTypeSchema).parse(res.rows);
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
        [
          ctx.dbUserId,
          input.name,
          input.color,
          input.bio,
          input.leaning,
          input.logo,
        ],
      );
      const partyId = partyRes.rows[0].id;

      await ctx.query("UPDATE users SET party_id = $1 WHERE id = $2", [
        partyId,
        ctx.dbUserId,
      ]);

      for (const stance of input.stanceValues) {
        await ctx.query(
          "INSERT INTO party_stances (party_id, stance_id, value) VALUES ($1, $2, $3)",
          [partyId, stance.id, stance.value],
        );
      }

      return PartySchema.parse(partyRes.rows[0]);
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
        "SELECT leader_id FROM parties WHERE id = $1",
        [input.partyId],
      );
      if (partyRes.rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Party not found" });
      }
      if (Number(partyRes.rows[0].leaderId) !== ctx.dbUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Leader only" });
      }

      const updateRes = await ctx.query(
        "UPDATE parties SET name = $1, color = $2, bio = $3, leaning = $4, logo = $5 WHERE id = $6 RETURNING *",
        [
          input.name,
          input.color,
          input.bio,
          input.leaning,
          input.logo,
          input.partyId,
        ],
      );

      for (const stance of input.stanceValues) {
        await ctx.query(
          "UPDATE party_stances SET value = $1 WHERE party_id = $2 AND stance_id = $3",
          [stance.value, input.partyId, stance.id],
        );
      }

      return PartySchema.parse(updateRes.rows[0]);
    }),

  join: authedProcedure
    .input(z.object({ partyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const res = await ctx.query(
        "UPDATE users SET party_id = $1 WHERE id = $2 RETURNING *",
        [input.partyId, ctx.dbUserId],
      );

      if (res.rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      return UserSchema.parse(res.rows[0]);
    }),

  leave: authedProcedure.input(z.object({})).mutation(async ({ ctx }) => {
    await ctx.query(
      "UPDATE parties SET leader_id = NULL WHERE leader_id = $1",
      [ctx.dbUserId],
    );
    const res = await ctx.query(
      "UPDATE users SET party_id = NULL WHERE id = $1 RETURNING *",
      [ctx.dbUserId],
    );

    const emptyRes = await ctx.query(`
        SELECT p.id FROM parties p
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.party_id = p.id)
      `);

    for (const party of emptyRes.rows) {
      await ctx.query("DELETE FROM party_stances WHERE party_id = $1", [
        party.id,
      ]);
      await ctx.query("DELETE FROM parties WHERE id = $1", [party.id]);
    }

    if (res.rows.length === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return UserSchema.parse(res.rows[0]);
  }),

  kick: authedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const memberRes = await ctx.query(
        "SELECT party_id FROM users WHERE id = $1",
        [input.userId],
      );

      const partyId = memberRes.rows[0]?.party_id ?? null;
      if (!partyId) {
        return SuccessSchema.parse({});
      }

      const leaderRes = await ctx.query(
        "SELECT leader_id FROM parties WHERE id = $1",
        [partyId],
      );

      if (Number(leaderRes.rows[0]?.leaderId) !== ctx.dbUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Leader only" });
      }
      await ctx.query("UPDATE users SET party_id = NULL WHERE id = $1", [
        input.userId,
      ]);

      return SuccessSchema.parse({});
    }),

  becomeLeader: authedProcedure
    .input(z.object({ partyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const memberRes = await ctx.query(
        "SELECT 1 FROM users WHERE id = $1 AND party_id = $2",
        [ctx.dbUserId, input.partyId],
      );

      if (memberRes.rows.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Must be party member to become leader",
        });
      }

      const res = await ctx.query(
        "UPDATE parties SET leader_id = $1 WHERE id = $2 RETURNING *",
        [ctx.dbUserId, input.partyId],
      );

      return PartySchema.parse(res.rows[0]);
    }),

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
      const leaderRes = await ctx.query(
        "SELECT leader_id FROM parties WHERE id = $1",
        [input.senderPartyId],
      );
      if (Number(leaderRes.rows[0]?.leaderId) !== ctx.dbUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Leader only" });
      }

      const existing = await ctx.query(
        `SELECT 1 FROM party_notifications
         WHERE sender_party_id = $1 AND receiver_party_id = $2 AND status = 'Pending'`,
        [input.senderPartyId, input.receiverPartyId],
      );
      if (existing.rows.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pending request already exists",
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
      const mergeRequestId = Number(mr.rows[0].id);

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

      return MergeRequestCreateSchema.parse({
        success: true,
        mergeRequestId,
      });
    }),

  mergeListIncoming: authedProcedure
    .input(z.object({ partyId: z.number() }))
    .query(async ({ input, ctx }) => {
      const leaderRes = await ctx.query(
        "SELECT leader_id FROM parties WHERE id = $1",
        [input.partyId],
      );

      if (Number(leaderRes.rows[0]?.leader_id) !== ctx.dbUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Leader only" });
      }

      const mergeRequests = await ctx.query(
        `
        SELECT 
          pn.merge_request_id, pn.sender_party_id, pn.status, pn.created_at,
          mr.id, mr.name, mr.color, mr.bio, mr.leaning, mr.logo,
          sp.name as sender_party_name, sp.color as sender_party_color
        FROM party_notifications pn
        JOIN merge_request mr ON pn.merge_request_id = mr.id
        JOIN parties sp ON pn.sender_party_id = sp.id
        WHERE pn.receiver_party_id = $1 AND pn.status = 'Pending'
        ORDER BY pn.created_at DESC
      `,
        [input.partyId],
      );

      if (mergeRequests.rows.length === 0) {
        return [];
      }

      const mergeIds = mergeRequests.rows.map((r) => Number(r.id));
      const stancesRes = await ctx.query(
        `
        SELECT mrs.merge_request_id, mrs.value, st.issue, st.description
        FROM merge_request_stances mrs
        JOIN political_stances st ON mrs.stance_id = st.id
        WHERE mrs.merge_request_id = ANY($1::int[])
      `,
        [mergeIds],
      );

      const stancesMap = new Map<number, z.infer<typeof MergeStanceSchema>[]>();

      for (const s of stancesRes.rows) {
        const id = Number(s.merge_request_id);
        if (!stancesMap.has(id)) {
          stancesMap.set(id, []);
        }
        stancesMap.get(id)?.push(
          MergeStanceSchema.parse({
            value: s.value,
            issue: s.issue,
            description: s.description,
          }),
        );
      }

      return z.array(MergeIncomingSchema).parse(
        mergeRequests.rows.map((r) => ({
          id: Number(r.merge_request_id),
          status: r.status,
          created_at: r.created_at,
          mergeData: {
            name: r.name,
            color: r.color,
            bio: r.bio,
            leaning: r.leaning ?? "",
            logo: r.logo,
            stances: stancesMap.get(Number(r.id)) ?? [],
          },
          senderParty: {
            id: Number(r.sender_party_id),
            name: r.sender_party_name,
            color: r.sender_party_color,
          },
        })),
      );
    }),

  mergeListSent: authedProcedure
    .input(z.object({ partyId: z.number() }))
    .query(async ({ input, ctx }) => {
      const leaderRes = await ctx.query(
        "SELECT leader_id FROM parties WHERE id = $1",
        [input.partyId],
      );

      if (Number(leaderRes.rows[0]?.leader_id) !== ctx.dbUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Leader only" });
      }

      const mergeRequests = await ctx.query(
        `
        SELECT 
          pn.merge_request_id, pn.receiver_party_id, pn.status, pn.created_at,
          mr.id, mr.name, mr.color, mr.bio, mr.leaning, mr.logo,
          rp.name as receiver_party_name, rp.color as receiver_party_color
        FROM party_notifications pn
        JOIN merge_request mr ON pn.merge_request_id = mr.id
        JOIN parties rp ON pn.receiver_party_id = rp.id
        WHERE pn.sender_party_id = $1 AND pn.status = 'Pending'
        ORDER BY pn.created_at DESC
      `,
        [input.partyId],
      );

      if (mergeRequests.rows.length === 0) {
        return [];
      }

      const mergeIds = mergeRequests.rows.map((r) => Number(r.id));
      const stancesRes = await ctx.query(
        `
        SELECT mrs.merge_request_id, mrs.value, st.issue, st.description
        FROM merge_request_stances mrs
        JOIN political_stances st ON mrs.stance_id = st.id
        WHERE mrs.merge_request_id = ANY($1::int[])
      `,
        [mergeIds],
      );

      const stancesMap = new Map<number, z.infer<typeof MergeStanceSchema>[]>();

      for (const s of stancesRes.rows) {
        const id = Number(s.merge_request_id);
        if (!stancesMap.has(id)) {
          stancesMap.set(id, []);
        }
        stancesMap.get(id)?.push(
          MergeStanceSchema.parse({
            value: s.value,
            issue: s.issue,
            description: s.description,
          }),
        );
      }

      return z.array(MergeSentSchema).parse(
        mergeRequests.rows.map((r) => ({
          id: Number(r.merge_request_id),
          status: r.status,
          created_at: r.created_at,
          mergeData: {
            name: r.name,
            color: r.color,
            bio: r.bio,
            leaning: r.leaning ?? "",
            logo: r.logo,
            stances: stancesMap.get(Number(r.id)) ?? [],
          },
          receiverParty: {
            id: Number(r.receiver_party_id),
            name: r.receiver_party_name,
            color: r.receiver_party_color,
          },
        })),
      );
    }),

  mergeAccept: authedProcedure
    .input(z.object({ mergeRequestId: z.number(), partyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const leaderRes = await ctx.query(
        "SELECT leader_id FROM parties WHERE id = $1",
        [input.partyId],
      );
      if (Number(leaderRes.rows[0]?.leaderId) !== ctx.dbUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Leader only" });
      }

      const notification = await ctx.query(
        `SELECT sender_party_id, receiver_party_id FROM party_notifications 
         WHERE merge_request_id = $1 AND receiver_party_id = $2 AND status = 'Pending'`,
        [input.mergeRequestId, input.partyId],
      );
      if (notification.rows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Merge request not found or processed",
        });
      }
      const { senderPartyId, receiverPartyId } = notification.rows[0];

      const mergeRequest = await ctx.query(
        "SELECT name, color, bio, leaning, logo FROM merge_request WHERE id = $1",
        [input.mergeRequestId],
      );
      if (mergeRequest.rows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Merge data not found",
        });
      }
      const mergeData = mergeRequest.rows[0];

      const mergeStances = await ctx.query(
        "SELECT stance_id, value FROM merge_request_stances WHERE merge_request_id = $1",
        [input.mergeRequestId],
      );

      await ctx.query("BEGIN");
      try {
        const newParty = await ctx.query(
          `INSERT INTO parties (name, color, bio, leaning, logo, leader_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
          [
            mergeData.name,
            mergeData.color,
            mergeData.bio,
            mergeData.leaning,
            mergeData.logo,
            ctx.dbUserId,
          ],
        );
        const newPartyId = Number(newParty.rows[0].id);

        for (const s of mergeStances.rows) {
          await ctx.query(
            "INSERT INTO party_stances (party_id, stance_id, value) VALUES ($1, $2, $3)",
            [newPartyId, s.stance_id, s.value],
          );
        }

        await ctx.query(
          "UPDATE users SET party_id = $1 WHERE party_id IN ($2, $3)",
          [newPartyId, senderPartyId, receiverPartyId],
        );

        await ctx.query(
          "DELETE FROM party_stances WHERE party_id IN ($1, $2)",
          [senderPartyId, receiverPartyId],
        );
        await ctx.query("DELETE FROM parties WHERE id IN ($1, $2)", [
          senderPartyId,
          receiverPartyId,
        ]);

        await ctx.query(
          `UPDATE party_notifications SET status = 'Accepted' WHERE merge_request_id = $1`,
          [input.mergeRequestId],
        );

        await ctx.query("COMMIT");

        return MergeAcceptSchema.parse({ success: true, newPartyId });
      } catch (e) {
        await ctx.query("ROLLBACK");
        throw e;
      }
    }),

  mergeReject: authedProcedure
    .input(z.object({ mergeRequestId: z.number(), partyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const leaderRes = await ctx.query(
        "SELECT leader_id FROM parties WHERE id = $1",
        [input.partyId],
      );

      if (Number(leaderRes.rows[0]?.leaderId) !== ctx.dbUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Leader only" });
      }

      const notification = await ctx.query(
        `SELECT 1 FROM party_notifications
         WHERE merge_request_id = $1 AND receiver_party_id = $2 AND status = 'Pending'`,
        [input.mergeRequestId, input.partyId],
      );

      if (notification.rows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Merge request not found or processed",
        });
      }

      await ctx.query(
        `UPDATE party_notifications SET status = 'Rejected' WHERE merge_request_id = $1`,
        [input.mergeRequestId],
      );

      return SuccessSchema.parse({});
    }),
});
