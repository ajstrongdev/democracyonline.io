import { createFileRoute } from "@tanstack/react-router";
import { OAuth2Client } from "google-auth-library";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { parties, users } from "@/db/schema";
import { env } from "@/env";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import { advanceElectionLifecycle } from "@/lib/server/election-lifecycle";
import { getAdminAuth } from "@/lib/firebase-admin";
import { archiveEmptyParties } from "@/lib/server/organization-lifecycle";

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

            const partyIds = [
              ...new Set(
                inactiveUsers.flatMap((user) =>
                  user.partyId === null ? [] : [user.partyId],
                ),
              ),
            ];
            const inactiveUserIds = inactiveUsers.map((user) => user.id);

            await db
              .update(users)
              .set({ partyId: null })
              .where(eq(users.isActive, false));

            await db.transaction(async (tx) => {
              await archiveEmptyParties(tx, partyIds);
              if (inactiveUserIds.length) {
                await tx
                  .update(parties)
                  .set({ leaderId: null })
                  .where(inArray(parties.leaderId, inactiveUserIds));
              }
            });
          }

          await db.transaction((tx) => archiveEmptyParties(tx));

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
