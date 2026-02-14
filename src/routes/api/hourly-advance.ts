import { createFileRoute } from "@tanstack/react-router";
import { OAuth2Client } from "google-auth-library";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  candidateSnapshots,
  candidates,
  companies,
  elections,
  feed,
  sharePriceHistory,
  stocks,
  transactionHistory,
  userShares,
  users,
} from "@/db/schema";
import { env } from "@/env";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import {
  calculateHourlyDividend,
  calculateMarketCap,
} from "@/lib/utils/stock-economy";

const oAuth2Client = new OAuth2Client();

export const Route = createFileRoute("/api/hourly-advance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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
        });

        if (authFailure) {
          return authFailure;
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
              capital: companies.capital,
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

            // Simple price adjustment based purely on demand
            // +$1 per share bought, -$1 per share sold
            let priceChange = bought - sold;

            // Natural decay: if no trading activity, reduce price by 1%
            if (bought === 0 && sold === 0) {
              const decay = Math.ceil(currentPrice * 0.01);
              priceChange = -decay;
            }

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
                `${stock.companySymbol}: $${currentPrice} → $${newPrice} (${priceChange > 0 ? "+" : ""}${priceChange}) | Bought: ${bought}, Sold: ${sold}${bought === 0 && sold === 0 ? " [DECAY]" : ""}`,
              );
            }
          }

          // Issue one new share per company each hour
          for (const stock of allStocks) {
            if (stock.companyId) {
              await db
                .update(companies)
                .set({
                  issuedShares: sql`${companies.issuedShares} + 1`,
                })
                .where(eq(companies.id, stock.companyId));

              console.log(
                `${stock.companySymbol}: Issued 1 new share (total: ${(stock.issuedShares || 0) + 1})`,
              );
            }
          }

          // Update company CEOs to whoever has the most shares
          for (const stock of allStocks) {
            if (stock.companyId) {
              const [company] = await db
                .select()
                .from(companies)
                .where(eq(companies.id, stock.companyId))
                .limit(1);

              if (company) {
                // Find the shareholder with the most shares
                const [topShareholder] = await db
                  .select({
                    userId: userShares.userId,
                    quantity: userShares.quantity,
                  })
                  .from(userShares)
                  .where(eq(userShares.companyId, company.id))
                  .orderBy(desc(userShares.quantity))
                  .limit(1);

                // Update CEO if there's a shareholder and they're different from current CEO
                if (
                  topShareholder &&
                  topShareholder.userId !== company.creatorId
                ) {
                  await db
                    .update(companies)
                    .set({ creatorId: topShareholder.userId })
                    .where(eq(companies.id, company.id));

                  console.log(
                    `Updated CEO of ${company.name} to user ${topShareholder.userId} with ${topShareholder.quantity} shares`,
                  );
                }
              }
            }
          }

          // Dissolve companies with no shareholders
          const dissolvedCompanies: Array<string> = [];
          for (const stock of allStocks) {
            if (stock.companyId) {
              const holders = await db
                .select({ userId: userShares.userId })
                .from(userShares)
                .where(eq(userShares.companyId, stock.companyId))
                .limit(1);

              if (holders.length === 0) {
                // Remove price history, stock entry, then company
                await db
                  .delete(sharePriceHistory)
                  .where(eq(sharePriceHistory.stockId, stock.id));
                await db.delete(stocks).where(eq(stocks.id, stock.id));
                await db
                  .delete(companies)
                  .where(eq(companies.id, stock.companyId));

                // Log to the public feed
                await db.insert(feed).values({
                  content: `${stock.companyName} (${stock.companySymbol}) has been dissolved due to having no shareholders.`,
                });

                dissolvedCompanies.push(stock.companySymbol);
                console.log(
                  `${stock.companySymbol}: Dissolved — no shareholders remaining`,
                );
              }
            }
          }

          // Filter out dissolved companies before paying dividends
          const activeStocks = allStocks.filter(
            (s) => !dissolvedCompanies.includes(s.companySymbol),
          );

          // Pay dividends to ALL shareholders proportionally
          // Ownership% × 10% of market cap per hour
          // e.g., 75% ownership = 7.5% of market cap, 100% = 10%, 1% = 0.1%
          let dividendsPaid = 0;
          for (const stock of activeStocks) {
            if (stock.companyId) {
              // Get all shareholders for this company
              const allHoldings = await db
                .select({
                  userId: userShares.userId,
                  quantity: userShares.quantity,
                })
                .from(userShares)
                .where(eq(userShares.companyId, stock.companyId));

              const issuedShares = stock.issuedShares || 0;

              if (issuedShares <= 0) continue;

              const marketCap = calculateMarketCap({
                sharePrice: stock.price,
                issuedShares,
              });

              for (const holding of allHoldings) {
                const qty = holding.quantity || 0;
                if (qty <= 0) continue;

                const ownershipPct = qty / issuedShares;
                // ownership% × 10% of market cap
                const dividend = calculateHourlyDividend({
                  ownershipPct,
                  marketCap,
                });

                if (dividend > 0) {
                  await db
                    .update(users)
                    .set({ money: sql`${users.money} + ${dividend}` })
                    .where(eq(users.id, holding.userId));

                  await db.insert(transactionHistory).values({
                    userId: holding.userId,
                    description: `Dividend from ${stock.companySymbol}: $${dividend.toLocaleString()} (${(ownershipPct * 100).toFixed(1)}% ownership, Market Cap: $${marketCap.toLocaleString()})`,
                  });

                  dividendsPaid += dividend;
                }
              }

              console.log(
                `${stock.companySymbol}: Paid dividends to ${allHoldings.length} shareholders (Market Cap: $${marketCap})`,
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
              message: `Updated ${allStocks.length} stock prices, paid $${dividendsPaid} in dividends, processed ${candidatesProcessed} candidates`,
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
