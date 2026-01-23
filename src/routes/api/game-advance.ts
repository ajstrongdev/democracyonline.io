import { createFileRoute } from "@tanstack/react-router";
import { OAuth2Client } from "google-auth-library";
import { db } from "@/db";
import {
  elections,
  candidates,
  votes,
  users,
  feed,
  parties,
  partyStances,
} from "@/db/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

const oAuth2Client = new OAuth2Client();

async function updateSenateSeats() {
  const candidatesCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(candidates)
    .where(eq(candidates.election, "Senate"));

  const candidateCount = candidatesCount[0]?.count || 0;

  const halfCandidates = Math.ceil(candidateCount * 0.5);
  const seats = Math.max(3, halfCandidates);

  await db
    .update(elections)
    .set({ seats })
    .where(eq(elections.election, "Senate"));
}

export const Route = createFileRoute("/api/game-advance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authHeader = request.headers.get("authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          console.error("Missing or invalid Authorization header");
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }
        const token = authHeader.substring(7);

        try {
          const ticket = await oAuth2Client.verifyIdToken({
            idToken: token,
            audience: process.env.VITE_SITE_URL || "https://democracyonline.io",
          });

          const payload = ticket.getPayload();

          const expectedEmailPattern =
            /-scheduler@.*\.iam\.gserviceaccount\.com$/;

          if (!payload?.email || !expectedEmailPattern.test(payload.email)) {
            console.error("Invalid service account:", payload?.email);
            return new Response(
              JSON.stringify({
                success: false,
                error: "Unauthorized - Invalid service account",
              }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }

          console.log("Authenticated request from:", payload.email);
        } catch (error) {
          console.error("Token validation failed:", error);
          return new Response(
            JSON.stringify({
              success: false,
              error: "Unauthorized - Invalid token",
            }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const presElection = await db
            .select()
            .from(elections)
            .where(eq(elections.election, "President"));

          const electionStatus = presElection[0]?.status;
          const daysLeft = presElection[0]?.daysLeft;

          if (electionStatus === "Candidate") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(eq(elections.election, "President"));
            } else {
              await db
                .update(elections)
                .set({ status: "Voting", daysLeft: 5 })
                .where(eq(elections.election, "President"));
            }
          } else if (electionStatus === "Voting") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(eq(elections.election, "President"));
            } else {
              await db
                .update(users)
                .set({ role: "Representative" })
                .where(eq(users.role, "President"));

              const candidatesRes = await db
                .select()
                .from(candidates)
                .where(eq(candidates.election, "President"))
                .orderBy(desc(candidates.votes));

              let winner = candidatesRes[0];

              const topVotes = winner?.votes || 0;
              const tiedCandidates = candidatesRes.filter(
                (c) => c.votes === topVotes,
              );

              if (tiedCandidates.length > 1) {
                const randomIndex = Math.floor(
                  Math.random() * tiedCandidates.length,
                );
                winner = tiedCandidates[randomIndex];
              }

              if (winner && winner.userId) {
                await db
                  .update(users)
                  .set({ role: "President" })
                  .where(eq(users.id, winner.userId));

                await db.insert(feed).values({
                  userId: winner.userId,
                  content: `has been elected as the President!`,
                });
              }

              await db
                .update(elections)
                .set({ status: "Concluded", daysLeft: 4 })
                .where(eq(elections.election, "President"));
            }
          } else if (electionStatus === "Concluded") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(eq(elections.election, "President"));
            } else {
              await db
                .delete(candidates)
                .where(eq(candidates.election, "President"));
              await db.delete(votes).where(eq(votes.election, "President"));
              await db
                .update(elections)
                .set({ status: "Candidate", daysLeft: 5 })
                .where(eq(elections.election, "President"));
            }
          }
        } catch (error) {
          console.error("Error handling presidential election status:", error);
          return new Response(
            JSON.stringify({
              success: false,
              error: "Internal Server Error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const senateElection = await db
            .select()
            .from(elections)
            .where(eq(elections.election, "Senate"));

          const electionStatus = senateElection[0]?.status;
          const daysLeft = senateElection[0]?.daysLeft;

          if (electionStatus === "Candidate") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(eq(elections.election, "Senate"));
            } else {
              await updateSenateSeats();
              await db
                .update(elections)
                .set({ status: "Voting", daysLeft: 2 })
                .where(eq(elections.election, "Senate"));
            }
          }

          if (electionStatus === "Voting") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(eq(elections.election, "Senate"));
            } else {
              await db
                .update(users)
                .set({ role: "Representative" })
                .where(eq(users.role, "Senator"));

              const seatsRes = await db
                .select()
                .from(elections)
                .where(eq(elections.election, "Senate"));

              const seats = seatsRes[0]?.seats || 1;

              const candidatesRes = await db
                .select()
                .from(candidates)
                .where(eq(candidates.election, "Senate"))
                .orderBy(desc(candidates.votes));

              const allCandidates = candidatesRes;

              if (allCandidates.length > 0) {
                const provisionalWinners = allCandidates.slice(0, seats);
                const lastWinnerVotes =
                  provisionalWinners[provisionalWinners.length - 1].votes || 0;

                const tiedCandidates = allCandidates.filter(
                  (c) => (c.votes || 0) === lastWinnerVotes,
                );

                let winners;
                if (tiedCandidates.length > 1) {
                  const nonTiedWinners = allCandidates.filter(
                    (w) => (w.votes || 0) > lastWinnerVotes,
                  );
                  const tiedSeats = seats - nonTiedWinners.length;
                  const shuffledTiedCandidates = tiedCandidates.sort(
                    () => 0.5 - Math.random(),
                  );
                  const selectedTiedWinners = shuffledTiedCandidates.slice(
                    0,
                    tiedSeats,
                  );
                  winners = nonTiedWinners.concat(selectedTiedWinners);
                } else {
                  winners = provisionalWinners;
                }

                const winnerIds = winners
                  .map((w) => w.userId)
                  .filter((id): id is number => id !== null);

                if (winnerIds.length > 0) {
                  await db
                    .update(users)
                    .set({ role: "Senator" })
                    .where(inArray(users.id, winnerIds));

                  for (const winner of winners) {
                    if (winner.userId) {
                      await db.insert(feed).values({
                        userId: winner.userId,
                        content: `has been elected as a Senator!`,
                      });
                    }
                  }
                }

                const remaining = Math.max(0, seats - winnerIds.length);
                if (remaining > 0) {
                  const fillerRes = await db
                    .select({ userId: users.id })
                    .from(users)
                    .where(
                      and(
                        sql`${users.username} NOT LIKE 'Banned User%'`,
                        sql`${users.role} NOT IN ('President', 'Senator')`,
                        winnerIds.length > 0
                          ? sql`${users.id} <> ALL(ARRAY[${sql.join(
                              winnerIds.map((id) => sql`${id}`),
                              sql`, `,
                            )}])`
                          : undefined,
                      ),
                    )
                    .orderBy(sql`RANDOM()`)
                    .limit(remaining);

                  const fillers = fillerRes;

                  if (fillers.length > 0) {
                    const fillerIds = fillers.map((f) => f.userId);
                    await db
                      .update(users)
                      .set({ role: "Senator" })
                      .where(inArray(users.id, fillerIds));

                    for (const filler of fillers) {
                      await db.insert(feed).values({
                        userId: filler.userId,
                        content: `has been appointed as a Senator!`,
                      });
                    }
                  }
                }
              }

              await db
                .update(elections)
                .set({ status: "Concluded", daysLeft: 3 })
                .where(eq(elections.election, "Senate"));
            }
          } else if (electionStatus === "Concluded") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(eq(elections.election, "Senate"));
            } else {
              await db
                .delete(candidates)
                .where(eq(candidates.election, "Senate"));
              await db.delete(votes).where(eq(votes.election, "Senate"));
              await db
                .update(elections)
                .set({ status: "Candidate", daysLeft: 2 })
                .where(eq(elections.election, "Senate"));
            }
          }

          await db
            .update(users)
            .set({ lastActivity: sql`${users.lastActivity} + 1` });

          await db
            .update(users)
            .set({ isActive: false })
            .where(sql`${users.lastActivity} >= 7`);

          const inactiveUsers = await db
            .select({ id: users.id, partyId: users.partyId })
            .from(users)
            .where(
              and(eq(users.isActive, false), sql`${users.partyId} IS NOT NULL`),
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
              await db
                .delete(partyStances)
                .where(eq(partyStances.partyId, partyId));
              await db.delete(parties).where(eq(parties.id, partyId));
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
            await db
              .delete(partyStances)
              .where(inArray(partyStances.partyId, emptyPartyIdList));

            await db
              .delete(parties)
              .where(inArray(parties.id, emptyPartyIdList));
          }

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error handling senate election status:", error);
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
