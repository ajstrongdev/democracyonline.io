import { createFileRoute } from "@tanstack/react-router";
import { OAuth2Client } from "google-auth-library";
import { and, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { feed, parties, users } from "@/db/schema";
import { env } from "@/env";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import { advanceElectionLifecycle } from "@/lib/server/election-lifecycle";
import {
  getGameAdvanceIntervalMs,
  getGameSpeed,
  getLastGameAdvanceAt,
  markGameAdvanceRun,
} from "@/lib/server/game-speed";
import { getAdminAuth } from "@/lib/firebase-admin";
import { archiveEmptyParties } from "@/lib/server/organization-lifecycle";
import { playerArchiveCutoff } from "@/lib/player-archive";

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

        // Archive on wall-clock time even when the game lifecycle is throttled.
        // Keep the account usable, but remove archived players from their parties.
        try {
          const now = new Date();
          const cutoff = playerArchiveCutoff(now);
          await db.transaction(async (tx) => {
            const archived = await tx
              .update(users)
              .set({ archivedAt: now })
              .where(and(isNull(users.archivedAt), lt(users.lastSeenAt, cutoff)))
              .returning({ id: users.id });

            // Also clean up players archived before party removal was introduced.
            const members = await tx
              .select({ id: users.id, partyId: users.partyId })
              .from(users)
              .where(and(isNotNull(users.archivedAt), isNotNull(users.partyId)))
              .for("update");
            if (members.length) {
              await tx
                .update(users)
                .set({ partyId: null })
                .where(inArray(users.id, members.map((member) => member.id)));

              const partyIds = [
                ...new Set(
                  members.flatMap((member) =>
                    member.partyId === null ? [] : [member.partyId],
                  ),
                ),
              ];
              await archiveEmptyParties(tx, partyIds);
              await tx
                .update(parties)
                .set({ leaderId: null })
                .where(
                  and(
                    inArray(parties.id, partyIds),
                    inArray(parties.leaderId, members.map((member) => member.id)),
                  ),
                );
            }

            if (archived.length) {
              await tx.insert(feed).values(
                archived.map((user) => ({
                  userId: user.id,
                  content:
                    "was archived after 14 real-life days without visiting",
                })),
              );
            }
          });
        } catch (error) {
          console.error("[game-advance] Error archiving players:", error);
          return new Response(
            JSON.stringify({ success: false, error: "Internal Server Error" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // The game lifecycle still runs at game speed.
        const gameSpeed = await getGameSpeed();
        const gameIntervalMs = getGameAdvanceIntervalMs(gameSpeed.multiplier);
        const lastRun = await getLastGameAdvanceAt();
        const now = new Date();
        if (lastRun && now.getTime() - lastRun.getTime() < gameIntervalMs) {
          return new Response(
            JSON.stringify({ success: true, skipped: true }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
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
          await db.transaction((tx) => archiveEmptyParties(tx));

          await markGameAdvanceRun(new Date());
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
