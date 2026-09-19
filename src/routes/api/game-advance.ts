import { createFileRoute } from "@tanstack/react-router";
import { OAuth2Client } from "google-auth-library";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  candidates,
  coalitionMembers,
  coalitions,
  elections,
  feed,
  joinRequests,
  parties,
  partyStances,
  primaryCandidates,
  primaryVotes,
  users,
  votes,
} from "@/db/schema";
import { env } from "@/env";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import { getAdminAuth } from "@/lib/firebase-admin";
import { resolvePrimaryWinners } from "@/lib/server/primaries-resolve";
import { archiveElection } from "@/lib/server/history";

const oAuth2Client = new OAuth2Client();

async function beginPresidentialVoting() {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = 'President' FOR UPDATE`,
    );
    const [election] = await tx
      .select({
        status: elections.status,
        daysLeft: elections.daysLeft,
        cycle: elections.cycle,
        seats: elections.seats,
      })
      .from(elections)
      .where(eq(elections.election, "President"));
    if (election?.status !== "Candidate" || (election.daysLeft ?? 0) > 1)
      return;

    const primaryRoster = await tx
      .select({
        userId: primaryCandidates.userId,
        partyId: primaryCandidates.partyId,
        coalitionId: primaryCandidates.coalitionId,
        votes: primaryCandidates.votes,
      })
      .from(primaryCandidates)
      .orderBy(desc(primaryCandidates.votes));
    const primaryWinnerIds = resolvePrimaryWinners(primaryRoster);
    for (const winnerUserId of primaryWinnerIds) {
      const [existing] = await tx
        .select({ id: candidates.id })
        .from(candidates)
        .where(
          and(
            eq(candidates.userId, winnerUserId),
            eq(candidates.election, "President"),
          ),
        )
        .limit(1);
      if (!existing) {
        await tx.insert(candidates).values({
          userId: winnerUserId,
          election: "President",
          votes: 0,
          haswon: false,
        });
      }
    }
    await tx.delete(primaryVotes);
    await tx.delete(primaryCandidates);

    await tx
      .update(elections)
      .set({ status: "Voting", daysLeft: 10 })
      .where(eq(elections.election, "President"));
  });
}

async function beginSenateVoting() {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = 'Senate' FOR UPDATE`,
    );
    const [election] = await tx
      .select({
        status: elections.status,
        daysLeft: elections.daysLeft,
        cycle: elections.cycle,
        seats: elections.seats,
      })
      .from(elections)
      .where(eq(elections.election, "Senate"));
    if (election?.status !== "Candidate" || (election.daysLeft ?? 0) > 1)
      return;

    const [candidateCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(candidates)
      .where(eq(candidates.election, "Senate"));
    const seats = Math.max(3, Math.ceil((candidateCount?.count ?? 0) * 0.5));

    await tx
      .update(elections)
      .set({ seats, status: "Voting", daysLeft: 4 })
      .where(eq(elections.election, "Senate"));
  });
}

async function concludePresidentialElection() {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = 'President' FOR UPDATE`,
    );
    const [election] = await tx
      .select({
        status: elections.status,
        daysLeft: elections.daysLeft,
        cycle: elections.cycle,
        seats: elections.seats,
      })
      .from(elections)
      .where(eq(elections.election, "President"));
    if (election?.status !== "Voting" || (election.daysLeft ?? 0) > 1) return;

    await tx
      .update(users)
      .set({ role: "Representative" })
      .where(eq(users.role, "President"));

    const candidatesRes = await tx
      .select()
      .from(candidates)
      .where(eq(candidates.election, "President"))
      .orderBy(desc(candidates.votes), candidates.id);
    const winner = candidatesRes[0];

    if (winner?.userId) {
      await tx
        .update(users)
        .set({ role: "President" })
        .where(eq(users.id, winner.userId));
      await tx
        .update(candidates)
        .set({ haswon: true })
        .where(eq(candidates.id, winner.id));
      await tx.insert(feed).values({
        userId: winner.userId,
        content: "has been elected as the President!",
      });
    } else {
      console.log(
        "No presidential candidates found, concluding without a winner",
      );
    }

    await archiveElection(tx, "President", election.cycle, election.seats);

    await tx
      .update(elections)
      .set({ status: "Concluded", daysLeft: 8 })
      .where(eq(elections.election, "President"));
  });
}

async function concludeSenateElection() {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = 'Senate' FOR UPDATE`,
    );
    const [election] = await tx
      .select({
        status: elections.status,
        daysLeft: elections.daysLeft,
        seats: elections.seats,
        cycle: elections.cycle,
      })
      .from(elections)
      .where(eq(elections.election, "Senate"));
    if (election?.status !== "Voting" || (election.daysLeft ?? 0) > 1) return;

    await tx
      .update(users)
      .set({ role: "Representative" })
      .where(eq(users.role, "Senator"));

    const seats = election.seats || 1;
    const allCandidates = await tx
      .select()
      .from(candidates)
      .where(eq(candidates.election, "Senate"))
      .orderBy(desc(candidates.votes), candidates.id);

    const winners = allCandidates.slice(0, seats);
    const winnerIds = winners
      .map((winner) => winner.userId)
      .filter((id): id is number => id !== null);

    if (winnerIds.length > 0) {
      await tx
        .update(users)
        .set({ role: "Senator" })
        .where(inArray(users.id, winnerIds));
      await tx
        .update(candidates)
        .set({ haswon: true })
        .where(
          inArray(
            candidates.id,
            winners.map((winner) => winner.id),
          ),
        );

      for (const winner of winners) {
        if (winner.userId) {
          await tx.insert(feed).values({
            userId: winner.userId,
            content: "has been elected as a Senator!",
          });
        }
      }
    }

    const remaining = Math.max(0, seats - winnerIds.length);
    if (remaining > 0) {
      const fillers = await tx
        .select({ userId: users.id })
        .from(users)
        .where(
          and(
            sql`${users.username} NOT LIKE 'Banned User%'`,
            sql`${users.role} NOT IN ('President', 'Senator')`,
            winnerIds.length > 0
              ? sql`${users.id} <> ALL(ARRAY[${sql.join(
                  winnerIds.map((id) => sql`${id}::integer`),
                  sql`, `,
                )}])`
              : undefined,
          ),
        )
        .orderBy(sql`RANDOM()`)
        .limit(remaining);

      if (fillers.length > 0) {
        const fillerIds = fillers.map((filler) => filler.userId);
        await tx
          .update(users)
          .set({ role: "Senator" })
          .where(inArray(users.id, fillerIds));
        for (const filler of fillers) {
          await tx.insert(feed).values({
            userId: filler.userId,
            content: "has been appointed as a Senator!",
          });
        }
      }
    }

    await archiveElection(tx, "Senate", election.cycle, election.seats);

    await tx
      .update(elections)
      .set({ status: "Concluded", daysLeft: 6 })
      .where(eq(elections.election, "Senate"));
  });
}

async function resetPresidentialElection() {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = 'President' FOR UPDATE`,
    );
    const [election] = await tx
      .select({ status: elections.status, daysLeft: elections.daysLeft })
      .from(elections)
      .where(eq(elections.election, "President"));
    if (election?.status !== "Concluded" || (election.daysLeft ?? 0) > 1)
      return;

    await tx.delete(votes).where(eq(votes.voteType, "President"));
    await tx.delete(candidates).where(eq(candidates.election, "President"));
    await tx.delete(primaryVotes);
    await tx.delete(primaryCandidates);
    await tx
      .update(elections)
      .set({
        status: "Candidate",
        daysLeft: 10,
        cycle: sql`${elections.cycle} + 1`,
      })
      .where(eq(elections.election, "President"));
  });
}

async function resetSenateElection() {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT ${elections.election} FROM ${elections} WHERE ${elections.election} = 'Senate' FOR UPDATE`,
    );
    const [election] = await tx
      .select({ status: elections.status, daysLeft: elections.daysLeft })
      .from(elections)
      .where(eq(elections.election, "Senate"));
    if (election?.status !== "Concluded" || (election.daysLeft ?? 0) > 1)
      return;

    await tx.delete(votes).where(eq(votes.voteType, "Senate"));
    await tx.delete(candidates).where(eq(candidates.election, "Senate"));
    await tx
      .update(elections)
      .set({
        status: "Candidate",
        daysLeft: 4,
        cycle: sql`${elections.cycle} + 1`,
      })
      .where(eq(elections.election, "Senate"));
  });
}

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

        console.log("[game-advance] Starting presidential election processing");
        try {
          const presElection = await db
            .select()
            .from(elections)
            .where(eq(elections.election, "President"));

          const electionStatus = presElection[0]?.status;
          const daysLeft = presElection[0]?.daysLeft;
          console.log(
            `[game-advance] Presidential status: ${electionStatus}, days left: ${daysLeft}`,
          );

          if (electionStatus === "Candidate") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(
                  and(
                    eq(elections.election, "President"),
                    eq(elections.status, "Candidate"),
                    eq(elections.daysLeft, daysLeft),
                  ),
                );
            } else {
              await beginPresidentialVoting();
            }
          } else if (electionStatus === "Voting") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(
                  and(
                    eq(elections.election, "President"),
                    eq(elections.status, "Voting"),
                    eq(elections.daysLeft, daysLeft),
                  ),
                );
            } else {
              await concludePresidentialElection();
            }
          } else if (electionStatus === "Concluded") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(
                  and(
                    eq(elections.election, "President"),
                    eq(elections.status, "Concluded"),
                    eq(elections.daysLeft, daysLeft),
                  ),
                );
            } else {
              await resetPresidentialElection();
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
          console.log("[game-advance] Starting senate election processing");
          const senateElection = await db
            .select()
            .from(elections)
            .where(eq(elections.election, "Senate"));

          const electionStatus = senateElection[0]?.status;
          const daysLeft = senateElection[0]?.daysLeft;
          console.log(
            `[game-advance] Senate status: ${electionStatus}, days left: ${daysLeft}`,
          );

          if (electionStatus === "Candidate") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(
                  and(
                    eq(elections.election, "Senate"),
                    eq(elections.status, "Candidate"),
                    eq(elections.daysLeft, daysLeft),
                  ),
                );
            } else {
              await beginSenateVoting();
            }
          } else if (electionStatus === "Voting") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(
                  and(
                    eq(elections.election, "Senate"),
                    eq(elections.status, "Voting"),
                    eq(elections.daysLeft, daysLeft),
                  ),
                );
            } else {
              await concludeSenateElection();
            }
          } else if (electionStatus === "Concluded") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(
                  and(
                    eq(elections.election, "Senate"),
                    eq(elections.status, "Concluded"),
                    eq(elections.daysLeft, daysLeft),
                  ),
                );
            } else {
              await resetSenateElection();
            }
          }

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
