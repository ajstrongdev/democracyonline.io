import { createFileRoute } from "@tanstack/react-router";
import { OAuth2Client } from "google-auth-library";
import { and, asc, eq, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  billVotesHouse,
  billVotesPresidential,
  billVotesSenate,
  bills,
  gameTracker,
  parties,
  partyStances,
  users,
} from "@/db/schema";
import { env } from "@/env";

const oAuth2Client = new OAuth2Client();

export const Route = createFileRoute("/api/bill-advance")({
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
            audience: env.SITE_URL || "https://democracyonline.io",
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
          const poolResult = await db.select().from(gameTracker);
          const currentPool =
            poolResult.length > 0 ? poolResult[0].billPool || 1 : 1;

          const nextPool = currentPool === 3 ? 1 : currentPool + 1;

          try {
            const presidentialBills = await db
              .select()
              .from(bills)
              .where(
                and(
                  eq(bills.stage, "Presidential"),
                  eq(bills.status, "Voting"),
                  eq(bills.pool, currentPool),
                ),
              );

            for (const bill of presidentialBills) {
              const votesRes = await db
                .select({
                  voteYes: billVotesPresidential.voteYes,
                  count: sql<number>`COUNT(*)::int`,
                })
                .from(billVotesPresidential)
                .where(eq(billVotesPresidential.billId, bill.id))
                .groupBy(billVotesPresidential.voteYes);

              const yesVotes =
                votesRes.find((row) => row.voteYes === true)?.count || 0;
              const noVotes =
                votesRes.find((row) => row.voteYes === false)?.count || 0;

              if (yesVotes > noVotes) {
                await db
                  .update(bills)
                  .set({ status: "Passed" })
                  .where(eq(bills.id, bill.id));
              } else {
                await db
                  .update(bills)
                  .set({ status: "Defeated" })
                  .where(eq(bills.id, bill.id));
              }
            }
          } catch (error) {
            console.error("Error processing presidential bills:", error);
            return new Response(
              JSON.stringify({
                success: false,
                error: "Internal Server Error",
              }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          try {
            const senateBills = await db
              .select()
              .from(bills)
              .where(
                and(
                  eq(bills.stage, "Senate"),
                  eq(bills.status, "Voting"),
                  eq(bills.pool, currentPool),
                ),
              );

            for (const bill of senateBills) {
              const votesRes = await db
                .select({
                  voteYes: billVotesSenate.voteYes,
                  count: sql<number>`COUNT(*)::int`,
                })
                .from(billVotesSenate)
                .where(eq(billVotesSenate.billId, bill.id))
                .groupBy(billVotesSenate.voteYes);

              const yesVotes =
                votesRes.find((row) => row.voteYes === true)?.count || 0;
              const noVotes =
                votesRes.find((row) => row.voteYes === false)?.count || 0;

              if (yesVotes > noVotes) {
                await db
                  .update(bills)
                  .set({ stage: "Presidential", status: "Voting" })
                  .where(eq(bills.id, bill.id));
              } else {
                await db
                  .update(bills)
                  .set({ status: "Defeated" })
                  .where(eq(bills.id, bill.id));
              }
            }
          } catch (error) {
            console.error("Error processing senate bills:", error);
            return new Response(
              JSON.stringify({
                success: false,
                error: "Internal Server Error",
              }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          try {
            const houseBills = await db
              .select()
              .from(bills)
              .where(
                and(
                  eq(bills.stage, "House"),
                  eq(bills.status, "Voting"),
                  eq(bills.pool, currentPool),
                ),
              );

            for (const bill of houseBills) {
              const votesRes = await db
                .select({
                  voteYes: billVotesHouse.voteYes,
                  count: sql<number>`COUNT(*)::int`,
                })
                .from(billVotesHouse)
                .where(eq(billVotesHouse.billId, bill.id))
                .groupBy(billVotesHouse.voteYes);

              const yesVotes =
                votesRes.find((row) => row.voteYes === true)?.count || 0;
              const noVotes =
                votesRes.find((row) => row.voteYes === false)?.count || 0;

              if (yesVotes > noVotes) {
                await db
                  .update(bills)
                  .set({ stage: "Senate", status: "Voting" })
                  .where(eq(bills.id, bill.id));
              } else {
                await db
                  .update(bills)
                  .set({ status: "Defeated" })
                  .where(eq(bills.id, bill.id));
              }
            }

            const nextBillRes = await db
              .select()
              .from(bills)
              .where(and(eq(bills.stage, "House"), eq(bills.status, "Queued")))
              .orderBy(asc(bills.createdAt))
              .limit(1);

            if (nextBillRes.length > 0) {
              const nextBill = nextBillRes[0];
              await db
                .update(bills)
                .set({ status: "Voting", pool: currentPool })
                .where(eq(bills.id, nextBill.id));
            }

            await db.update(gameTracker).set({ billPool: nextPool });

            try {
              const emptyParties = await db
                .select({ id: parties.id })
                .from(parties)
                .where(
                  notExists(
                    db
                      .select()
                      .from(users)
                      .where(eq(users.partyId, parties.id)),
                  ),
                );

              for (const party of emptyParties) {
                await db
                  .delete(partyStances)
                  .where(eq(partyStances.partyId, party.id));
                await db.delete(parties).where(eq(parties.id, party.id));
                console.log(`Deleted empty party with ID: ${party.id}`);
              }
            } catch (error) {
              console.error("Error deleting zero-member parties:", error);
            }

            return new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            console.error("Error advancing bill:", error);
            return new Response(
              JSON.stringify({
                success: false,
                error: "Internal Server Error",
              }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
        } catch (error) {
          console.error("Error processing bill advance:", error);
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
