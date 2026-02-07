import { createFileRoute } from "@tanstack/react-router";
import { OAuth2Client } from "google-auth-library";
import { db } from "@/db";
import {
  stocks,
  sharePriceHistory,
  companies,
  candidates,
  elections,
  candidateSnapshots,
} from "@/db/schema";
import { env } from "@/env";
import { eq, sql } from "drizzle-orm";

const oAuth2Client = new OAuth2Client();

export const Route = createFileRoute("/api/hourly-advance")({
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
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          }
        } catch (error) {
          console.error("Token verification failed:", error);
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const allStocks = await db
            .select({
              id: stocks.id,
              companyId: stocks.companyId,
              price: stocks.price,
              broughtToday: stocks.broughtToday,
              soldToday: stocks.soldToday,
              issuedShares: companies.issuedShares,
              companyName: companies.name,
              companySymbol: companies.symbol,
            })
            .from(stocks)
            .innerJoin(companies, eq(stocks.companyId, companies.id));

          console.log(
            `Processing ${allStocks.length} stocks for price updates`,
          );

          for (const stock of allStocks) {
            const bought = stock.broughtToday || 0;
            const sold = stock.soldToday || 0;
            const currentPrice = stock.price;

            // Simple price adjustment: +$1 per share bought, -$1 per share sold
            const priceChange = bought - sold;
            let newPrice = currentPrice + priceChange;

            // Ensure price doesn't go below $10 minimum
            const MIN_PRICE = 10;
            newPrice = Math.max(MIN_PRICE, newPrice);

            // Always log price history to maintain chart continuity
            await db.insert(sharePriceHistory).values({
              stockId: stock.id,
              price: newPrice,
            });

            // Update stock price and reset daily counters
            await db
              .update(stocks)
              .set({
                price: newPrice,
                broughtToday: 0,
                soldToday: 0,
              })
              .where(eq(stocks.id, stock.id));

            if (priceChange !== 0) {
              console.log(
                `${stock.companySymbol}: $${currentPrice} → $${newPrice} (${priceChange > 0 ? "+" : ""}${priceChange}) | Bought: ${bought}, Sold: ${sold}`,
              );
            }
          }

          // Process candidate votes and donations per hour for elections in voting phase
          const votingElections = await db
            .select({ election: elections.election })
            .from(elections)
            .where(eq(elections.status, "Voting"));

          let candidatesProcessed = 0;

          for (const election of votingElections) {
            const electionCandidates = await db
              .select({
                id: candidates.id,
                election: candidates.election,
                votes: candidates.votes,
                donations: candidates.donations,
                votesPerHour: candidates.votesPerHour,
                donationsPerHour: candidates.donationsPerHour,
              })
              .from(candidates)
              .where(eq(candidates.election, election.election));

            for (const candidate of electionCandidates) {
              const votesPerHour = candidate.votesPerHour || 0;
              const donationsPerHour = candidate.donationsPerHour || 0;

              // Update candidate with hourly gains
              if (votesPerHour > 0 || donationsPerHour > 0) {
                await db
                  .update(candidates)
                  .set({
                    votes: sql`${candidates.votes} + ${votesPerHour}`,
                    donations: sql`${candidates.donations} + ${donationsPerHour}`,
                  })
                  .where(eq(candidates.id, candidate.id));

                console.log(
                  `Candidate ${candidate.id}: +${votesPerHour} votes, +$${donationsPerHour} donations`,
                );
              }

              // Create snapshot for this candidate
              await db.insert(candidateSnapshots).values({
                candidateId: candidate.id,
                election: candidate.election || election.election,
                votes: (candidate.votes || 0) + votesPerHour,
                donations: Number(candidate.donations || 0) + donationsPerHour,
              });

              candidatesProcessed++;
            }
          }

          console.log(
            `Processed ${candidatesProcessed} candidates across ${votingElections.length} voting elections`,
          );

          return new Response(
            JSON.stringify({
              success: true,
              message: `Updated ${allStocks.length} stock prices, processed ${candidatesProcessed} candidates`,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (error) {
          console.error("Error advancing stocks:", error);
          return new Response(
            JSON.stringify({
              success: false,
              error: "Internal Server Error",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },
  },
});
