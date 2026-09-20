import { createFileRoute } from "@tanstack/react-router";
import { OAuth2Client } from "google-auth-library";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  coalitionMembers,
  coalitions,
  joinRequests,
  parties,
  partyStances,
  users,
} from "@/db/schema";
import { env } from "@/env";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import { advanceElectionLifecycle } from "@/lib/server/election-lifecycle";
import { getAdminAuth } from "@/lib/firebase-admin";

const oAuth2Client = new OAuth2Client();

export const Route = createFileRoute("/api/game-advance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        console.log("[game-advance] Handler started");
        const authFailure = await authorizeCronRequest({
          request,
          env,
          verifySchedulerIdToken: async ({ idToken, audience }) => {
            const ticket = await oAuth2Client.verifyIdToken({
              idToken,
              audience,
            });

            return { email: ticket.getPayload()?.email };
          },
          verifyAdminIdToken: async ({ idToken }) => {
            const decoded = await getAdminAuth().verifyIdToken(idToken);
            return { email: decoded.email };
          },
        });

        if (authFailure) {
          return authFailure;
        }

        try {
          console.log("[game-advance] Advancing election lifecycle");
          await advanceElectionLifecycle();
        } catch (error) {
          console.error("Error handling election lifecycle:", error);
          return new Response(
            JSON.stringify({
              success: false,
              error: "Internal Server Error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          if (env.DEPLOYED_ENV === "dev") {
            // In dev deployment, skip inactivity — keep all users active
            console.log(
              "[game-advance] Dev environment: skipping inactivity, keeping all users active",
            );
            await db.update(users).set({ isActive: true, lastActivity: 0 });
          } else {
            console.log("[game-advance] Updating user activity");
            await db
              .update(users)
              .set({ lastActivity: sql`${users.lastActivity} + 1` });

            // Ensure users with recent activity are marked active
            await db
              .update(users)
              .set({ isActive: true })
              .where(sql`${users.lastActivity} < 14`);

            await db
              .update(users)
              .set({ isActive: false })
              .where(sql`${users.lastActivity} >= 14`);

            const inactiveUsers = await db
              .select({ id: users.id, partyId: users.partyId })
              .from(users)
              .where(
                and(
                  eq(users.isActive, false),
                  sql`${users.partyId} IS NOT NULL`,
                ),
              );

            const partyIds = new Set<number>();

            for (const user of inactiveUsers) {
              const partyId = user.partyId;
              if (partyId) {
                partyIds.add(partyId);

                await db
                  .update(parties)
                  .set({ leaderId: null })
                  .where(
                    and(eq(parties.id, partyId), eq(parties.leaderId, user.id)),
                  );
              }
            }

            await db
              .update(users)
              .set({ partyId: null })
              .where(eq(users.isActive, false));

            for (const partyId of partyIds) {
              const countRes = await db
                .select({ cnt: sql<number>`COUNT(*)::int` })
                .from(users)
                .where(eq(users.partyId, partyId));

              const memberCount = countRes[0]?.cnt ?? 0;

              if (memberCount === 0) {
                const partyCoalitions = await db
                  .select({ coalitionId: coalitionMembers.coalitionId })
                  .from(coalitionMembers)
                  .where(eq(coalitionMembers.partyId, partyId));

                await db
                  .delete(coalitionMembers)
                  .where(eq(coalitionMembers.partyId, partyId));
                await db
                  .delete(joinRequests)
                  .where(eq(joinRequests.partyId, partyId));

                for (const { coalitionId } of partyCoalitions) {
                  const remaining = await db
                    .select({ coalitionId: coalitionMembers.coalitionId })
                    .from(coalitionMembers)
                    .where(eq(coalitionMembers.coalitionId, coalitionId))
                    .limit(1);
                  if (remaining.length === 0) {
                    await db
                      .delete(joinRequests)
                      .where(eq(joinRequests.coalitionId, coalitionId));
                    await db
                      .delete(coalitions)
                      .where(eq(coalitions.id, coalitionId));
                  }
                }

                await db
                  .delete(partyStances)
                  .where(eq(partyStances.partyId, partyId));
                await db.delete(parties).where(eq(parties.id, partyId));
              }
            }
          }

          const emptyPartyIds = await db
            .select({ id: parties.id })
            .from(parties)
            .leftJoin(users, eq(parties.id, users.partyId))
            .groupBy(parties.id)
            .having(sql`COUNT(${users.id}) = 0`);

          const emptyPartyIdList = emptyPartyIds.map((p) => p.id);

          if (emptyPartyIdList.length > 0) {
            // Clean up coalition memberships for empty parties
            const affectedCoalitions = await db
              .select({ coalitionId: coalitionMembers.coalitionId })
              .from(coalitionMembers)
              .where(inArray(coalitionMembers.partyId, emptyPartyIdList));

            await db
              .delete(coalitionMembers)
              .where(inArray(coalitionMembers.partyId, emptyPartyIdList));
            await db
              .delete(joinRequests)
              .where(inArray(joinRequests.partyId, emptyPartyIdList));

            // Dissolve any coalitions left empty
            const coalitionIds = [
              ...new Set(affectedCoalitions.map((r) => r.coalitionId)),
            ];
            for (const coalitionId of coalitionIds) {
              const remaining = await db
                .select({ coalitionId: coalitionMembers.coalitionId })
                .from(coalitionMembers)
                .where(eq(coalitionMembers.coalitionId, coalitionId))
                .limit(1);
              if (remaining.length === 0) {
                await db
                  .delete(joinRequests)
                  .where(eq(joinRequests.coalitionId, coalitionId));
                await db
                  .delete(coalitions)
                  .where(eq(coalitions.id, coalitionId));
              }
            }

            await db
              .delete(partyStances)
              .where(inArray(partyStances.partyId, emptyPartyIdList));

            await db
              .delete(parties)
              .where(inArray(parties.id, emptyPartyIdList));
          }

          console.log("[game-advance] Game advance completed successfully");
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("[game-advance] Error in game-advance:", error);
          console.error(
            "[game-advance] Error stack:",
            error instanceof Error ? error.stack : "No stack trace",
          );
          return new Response(
            JSON.stringify({
              success: false,
              error: "Internal Server Error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
