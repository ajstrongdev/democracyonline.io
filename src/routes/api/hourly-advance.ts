import { createFileRoute } from "@tanstack/react-router";
import { OAuth2Client } from "google-auth-library";
import { and, asc, desc, eq, gte, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  candidateSnapshots,
  candidates,
  companies,
  elections,
  feed,
  financeKpiSnapshots,
  gameState,
  orderFills,
  shareIssuanceEvents,
  sharePriceHistory,
  stockOrders,
  stocks,
  transactionHistory,
  userShares,
  users,
} from "@/db/schema";
import { env } from "@/env";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import { getAdminAuth } from "@/lib/firebase-admin";
import {
  calculateDividendPerShareMilli,
  calculateHourlyDividendPool,
  calculateOneShareOwnershipDriftBps,
  shouldTriggerBuyPressureMint,
} from "@/lib/utils/share-issuance-policy";
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
          verifyAdminIdToken: async ({ idToken }) => {
            const decoded = await getAdminAuth().verifyIdToken(idToken);
            return { email: decoded.email };
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

          // ========== ADVANCE GAME HOUR ==========
          // Upsert the game state row and increment the game hour counter
          await db
            .insert(gameState)
            .values({ id: 1, currentGameHour: 1 })
            .onConflictDoUpdate({
              target: gameState.id,
              set: {
                currentGameHour: sql`${gameState.currentGameHour} + 1`,
              },
            });

          const [currentGameStateRow] = await db
            .select({ currentGameHour: gameState.currentGameHour })
            .from(gameState)
            .where(eq(gameState.id, 1))
            .limit(1);

          const currentGameHour = currentGameStateRow?.currentGameHour ?? 0;
          console.log(`Game hour advanced to ${currentGameHour}`);

          // ========== ORDER MATCHING ==========
          // Match buy orders with sell orders per company (FIFO queue)
          let totalOrdersFilled = 0;
          let totalSharesTraded = 0;

          for (const stock of allStocks) {
            if (!stock.companyId) continue;

            // Get all open/partial sell orders for this company, ordered by creation (FIFO)
            // Exclude self-trades by matching later
            const sellOrders = await db
              .select()
              .from(stockOrders)
              .where(
                and(
                  eq(stockOrders.companyId, stock.companyId),
                  eq(stockOrders.side, "sell"),
                  or(
                    eq(stockOrders.status, "open"),
                    eq(stockOrders.status, "partial"),
                  ),
                ),
              )
              .orderBy(asc(stockOrders.createdAt));

            // Get all open/partial buy orders for this company, ordered by creation (FIFO)
            const buyOrders = await db
              .select()
              .from(stockOrders)
              .where(
                and(
                  eq(stockOrders.companyId, stock.companyId),
                  eq(stockOrders.side, "buy"),
                  or(
                    eq(stockOrders.status, "open"),
                    eq(stockOrders.status, "partial"),
                  ),
                ),
              )
              .orderBy(asc(stockOrders.createdAt));

            if (buyOrders.length === 0 || sellOrders.length === 0) continue;

            let sharesMatchedThisStock = 0;

            // For each buy order, try to fill from sell orders (FIFO)
            for (const buyOrder of buyOrders) {
              let buyRemaining = buyOrder.quantity - buyOrder.filledQuantity;
              if (buyRemaining <= 0) continue;

              for (const sellOrder of sellOrders) {
                if (buyRemaining <= 0) break;

                // Skip self-trades — shares must be bought from another player
                if (sellOrder.userId === buyOrder.userId) continue;

                let sellRemaining =
                  sellOrder.quantity - sellOrder.filledQuantity;
                if (sellRemaining <= 0) continue;

                // The trade executes at the buy order's price (buyer already escrowed this)
                const tradePrice = buyOrder.pricePerShare;
                const fillQty = Math.min(buyRemaining, sellRemaining);

                // Buyer already escrowed funds at order time, so they can afford.
                let actualFillQty = fillQty;

                // Verify seller actually has the shares
                const [sellerHolding] = await db
                  .select({ quantity: userShares.quantity })
                  .from(userShares)
                  .where(
                    and(
                      eq(userShares.userId, sellOrder.userId),
                      eq(userShares.companyId, stock.companyId!),
                    ),
                  )
                  .limit(1);

                const sellerOwnedShares = sellerHolding?.quantity || 0;

                if (sellerOwnedShares < actualFillQty) {
                  actualFillQty = Math.max(0, sellerOwnedShares);
                }

                if (actualFillQty <= 0) continue;

                const totalTradeValue = tradePrice * actualFillQty;

                // Execute the trade
                // 1. Transfer shares: seller -> buyer
                // Deduct from seller
                await db
                  .update(userShares)
                  .set({
                    quantity: sql`${userShares.quantity} - ${actualFillQty}`,
                  })
                  .where(
                    and(
                      eq(userShares.userId, sellOrder.userId),
                      eq(userShares.companyId, stock.companyId!),
                    ),
                  );

                // Clean up zero holdings
                await db
                  .delete(userShares)
                  .where(
                    and(
                      eq(userShares.userId, sellOrder.userId),
                      eq(userShares.companyId, stock.companyId!),
                      sql`${userShares.quantity} <= 0`,
                    ),
                  );

                // Add to buyer
                await db
                  .insert(userShares)
                  .values({
                    userId: buyOrder.userId,
                    companyId: stock.companyId!,
                    quantity: actualFillQty,
                  })
                  .onConflictDoUpdate({
                    target: [userShares.userId, userShares.companyId],
                    set: {
                      quantity: sql`${userShares.quantity} + ${actualFillQty}`,
                    },
                  });

                // 2. Pay seller (they only get money when shares are actually bought)
                await db
                  .update(users)
                  .set({ money: sql`${users.money} + ${totalTradeValue}` })
                  .where(eq(users.id, sellOrder.userId));

                // 3. Update order fill quantities
                const newBuyFilled = buyOrder.filledQuantity + actualFillQty;
                const buyStatus =
                  newBuyFilled >= buyOrder.quantity ? "filled" : "partial";
                await db
                  .update(stockOrders)
                  .set({
                    filledQuantity: newBuyFilled,
                    status: buyStatus,
                    updatedAt: new Date(),
                  })
                  .where(eq(stockOrders.id, buyOrder.id));
                buyOrder.filledQuantity = newBuyFilled;

                const newSellFilled = sellOrder.filledQuantity + actualFillQty;
                const sellStatus =
                  newSellFilled >= sellOrder.quantity ? "filled" : "partial";
                await db
                  .update(stockOrders)
                  .set({
                    filledQuantity: newSellFilled,
                    status: sellStatus,
                    updatedAt: new Date(),
                  })
                  .where(eq(stockOrders.id, sellOrder.id));
                sellOrder.filledQuantity = newSellFilled;

                // 4. Record the fill
                await db.insert(orderFills).values({
                  buyOrderId: buyOrder.id,
                  sellOrderId: sellOrder.id,
                  companyId: stock.companyId!,
                  buyerUserId: buyOrder.userId,
                  sellerUserId: sellOrder.userId,
                  quantity: actualFillQty,
                  pricePerShare: tradePrice,
                  totalPrice: totalTradeValue,
                });

                // 5. Update stock broughtToday (buy pressure for price calculation)
                await db
                  .update(stocks)
                  .set({
                    broughtToday: sql`COALESCE(${stocks.broughtToday}, 0) + ${actualFillQty}`,
                  })
                  .where(eq(stocks.id, stock.id));

                // 6. Transaction history for both parties
                const [companyInfo] = await db
                  .select({ name: companies.name, symbol: companies.symbol })
                  .from(companies)
                  .where(eq(companies.id, stock.companyId!))
                  .limit(1);

                await db.insert(transactionHistory).values({
                  userId: buyOrder.userId,
                  description: `Buy order filled: ${actualFillQty} share${actualFillQty > 1 ? "s" : ""} of ${companyInfo?.name} (${companyInfo?.symbol}) at $${tradePrice.toLocaleString()}/share`,
                });

                await db.insert(transactionHistory).values({
                  userId: sellOrder.userId,
                  description: `Sell order filled: ${actualFillQty} share${actualFillQty > 1 ? "s" : ""} of ${companyInfo?.name} (${companyInfo?.symbol}) at $${tradePrice.toLocaleString()}/share — received $${totalTradeValue.toLocaleString()}`,
                });

                buyRemaining -= actualFillQty;
                sharesMatchedThisStock += actualFillQty;
                totalOrdersFilled++;
              }
            }

            totalSharesTraded += sharesMatchedThisStock;

            if (sharesMatchedThisStock > 0) {
              console.log(
                `${stock.companySymbol}: Matched ${sharesMatchedThisStock} shares via order book`,
              );
            }
          }

          // ========== TREASURY FILLS ==========
          // Fill buy orders from unowned (treasury) shares
          let treasurySharesSold = 0;

          for (const stock of allStocks) {
            if (!stock.companyId) continue;

            // Calculate how many shares are unowned (treasury)
            const [totalOwnedResult] = await db
              .select({
                total: sql<number>`COALESCE(SUM(${userShares.quantity}), 0)::int`,
              })
              .from(userShares)
              .where(eq(userShares.companyId, stock.companyId));

            const totalOwned = totalOwnedResult?.total || 0;
            const unownedShares = (stock.issuedShares || 0) - totalOwned;

            const availableShares = unownedShares;

            if (availableShares <= 0) continue;

            // Get first unfilled buy order for this company (FIFO, only 1 share)
            const remainingBuyOrders = await db
              .select()
              .from(stockOrders)
              .where(
                and(
                  eq(stockOrders.companyId, stock.companyId),
                  eq(stockOrders.side, "buy"),
                  or(
                    eq(stockOrders.status, "open"),
                    eq(stockOrders.status, "partial"),
                  ),
                ),
              )
              .orderBy(asc(stockOrders.createdAt))
              .limit(50);

            let sharesLeftToSell = availableShares;

            for (const buyOrder of remainingBuyOrders) {
              if (sharesLeftToSell <= 0) break;

              const buyRemaining = buyOrder.quantity - buyOrder.filledQuantity;
              if (buyRemaining <= 0) continue;

              const fillQty = Math.min(buyRemaining, sharesLeftToSell);
              const tradePrice = buyOrder.pricePerShare;
              const totalTradeValue = tradePrice * fillQty;

              // Give shares to buyer
              await db
                .insert(userShares)
                .values({
                  userId: buyOrder.userId,
                  companyId: stock.companyId!,
                  quantity: fillQty,
                })
                .onConflictDoUpdate({
                  target: [userShares.userId, userShares.companyId],
                  set: {
                    quantity: sql`${userShares.quantity} + ${fillQty}`,
                  },
                });

              // Payment goes to company capital (treasury sale proceeds)
              await db
                .update(companies)
                .set({
                  capital: sql`${companies.capital} + ${totalTradeValue}`,
                })
                .where(eq(companies.id, stock.companyId!));

              // Update buy order fill progress
              const newBuyFilled = buyOrder.filledQuantity + fillQty;
              const buyStatus =
                newBuyFilled >= buyOrder.quantity ? "filled" : "partial";
              await db
                .update(stockOrders)
                .set({
                  filledQuantity: newBuyFilled,
                  status: buyStatus,
                  updatedAt: new Date(),
                })
                .where(eq(stockOrders.id, buyOrder.id));

              // Count as buying pressure for price calculation
              await db
                .update(stocks)
                .set({
                  broughtToday: sql`COALESCE(${stocks.broughtToday}, 0) + ${fillQty}`,
                })
                .where(eq(stocks.id, stock.id));

              // Transaction history
              await db.insert(transactionHistory).values({
                userId: buyOrder.userId,
                description: `Buy order filled from treasury: ${fillQty} share${fillQty > 1 ? "s" : ""} of ${stock.companyName} (${stock.companySymbol}) at $${tradePrice.toLocaleString()}/share`,
              });

              sharesLeftToSell -= fillQty;
              treasurySharesSold += fillQty;
              totalSharesTraded += fillQty;
              totalOrdersFilled++;
            }
          }

          if (treasurySharesSold > 0) {
            console.log(
              `Treasury fills: ${treasurySharesSold} shares sold from available/minted supply`,
            );
          }

          // ========== ORPHANED SELL ORDER CLEANUP ==========
          // Cancel sell orders that can never fill because the only buy orders
          // are from the seller themselves (prevents permanent share lockup)
          // Track cancelled shares as sell pressure (oversupply signal)
          let cancelledOrphanedOrders = 0;
          const orphanedSellSharesByStock: Record<number, number> = {};

          for (const stock of allStocks) {
            if (!stock.companyId) continue;

            const openSellOrders = await db
              .select()
              .from(stockOrders)
              .where(
                and(
                  eq(stockOrders.companyId, stock.companyId),
                  eq(stockOrders.side, "sell"),
                  or(
                    eq(stockOrders.status, "open"),
                    eq(stockOrders.status, "partial"),
                  ),
                ),
              );

            if (openSellOrders.length === 0) continue;

            // Check if there are ANY buy orders from OTHER users for this company
            for (const sellOrder of openSellOrders) {
              const sellRemaining =
                sellOrder.quantity - sellOrder.filledQuantity;
              if (sellRemaining <= 0) continue;

              // Are there buy orders from users OTHER than this seller?
              const [counterpartyResult] = await db
                .select({
                  count: sql<number>`COUNT(*)::int`,
                })
                .from(stockOrders)
                .where(
                  and(
                    eq(stockOrders.companyId, stock.companyId),
                    eq(stockOrders.side, "buy"),
                    or(
                      eq(stockOrders.status, "open"),
                      eq(stockOrders.status, "partial"),
                    ),
                    sql`${stockOrders.userId} != ${sellOrder.userId}`,
                  ),
                );

              const hasCounterparty = (counterpartyResult?.count || 0) > 0;

              if (!hasCounterparty) {
                // No other users have buy orders — this sell order will never fill
                await db
                  .update(stockOrders)
                  .set({ status: "cancelled", updatedAt: new Date() })
                  .where(eq(stockOrders.id, sellOrder.id));

                await db.insert(transactionHistory).values({
                  userId: sellOrder.userId,
                  description: `Sell order auto-cancelled: ${sellRemaining} share${sellRemaining > 1 ? "s" : ""} of ${stock.companyName} (${stock.companySymbol}) — no buyers available`,
                });

                // Track as sell pressure — people tried to sell but couldn't
                orphanedSellSharesByStock[stock.id] =
                  (orphanedSellSharesByStock[stock.id] || 0) + sellRemaining;

                cancelledOrphanedOrders++;
                console.log(
                  `${stock.companySymbol}: Auto-cancelled orphaned sell order ${sellOrder.id} (no counterparty buyers)`,
                );
              }
            }
          }

          if (cancelledOrphanedOrders > 0) {
            console.log(
              `Orphan cleanup: ${cancelledOrphanedOrders} sell orders auto-cancelled`,
            );
          }

          console.log(
            `Order matching complete: ${totalSharesTraded} shares traded across ${totalOrdersFilled} fills`,
          );

          // ========== SELL PRESSURE FROM CANCELLED ORDERS ==========
          // Cancelled sell orders = people wanted to sell but found no buyers = oversupply
          for (const [stockId, cancelledShares] of Object.entries(
            orphanedSellSharesByStock,
          )) {
            if (cancelledShares > 0) {
              await db
                .update(stocks)
                .set({
                  soldToday: sql`COALESCE(${stocks.soldToday}, 0) + ${cancelledShares}`,
                })
                .where(eq(stocks.id, Number(stockId)));
            }
          }

          // Re-fetch stocks to get updated broughtToday/soldToday after order matching
          const updatedStocks = await db
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

          const issuancePolicy = env.SHARE_ISSUANCE_POLICY;
          const dailyMintCap = env.DAILY_COMPANY_MINT_CAP;
          const buyPressureThreshold = env.BUY_PRESSURE_MINT_THRESHOLD;
          const buyPressureTriggerEnabled =
            env.ENABLE_BUY_PRESSURE_MINT_TRIGGER;

          const dayStart = new Date();
          dayStart.setHours(0, 0, 0, 0);
          const nextDayStart = new Date(dayStart);
          nextDayStart.setDate(nextDayStart.getDate() + 1);

          let issuedThisTick = 0;
          let issuanceEvents = 0;

          for (const stock of updatedStocks) {
            const bought = stock.broughtToday || 0;
            const sold = stock.soldToday || 0;
            const currentPrice = stock.price;

            // Price adjustment: buy fills push up, unfilled sell orders push down
            // bought = shares filled from buy orders (P2P + treasury)
            // sold = unfilled shares sitting in open sell orders (oversupply pressure)
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

          if (issuancePolicy === "legacy-hourly") {
            for (const stock of updatedStocks) {
              if (!stock.companyId) {
                continue;
              }

              const issuedSharesBefore = Number(stock.issuedShares || 0);
              const mintedShares = 1;
              const issuedSharesAfter = issuedSharesBefore + mintedShares;

              const activeHoldersResult = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(userShares)
                .where(
                  and(
                    eq(userShares.companyId, stock.companyId),
                    gte(userShares.quantity, 1),
                  ),
                );

              const activeHolders = activeHoldersResult[0]?.count || 0;

              await db
                .update(companies)
                .set({
                  issuedShares: issuedSharesAfter,
                })
                .where(eq(companies.id, stock.companyId));

              await db.insert(shareIssuanceEvents).values({
                companyId: stock.companyId,
                policy: issuancePolicy,
                source: "legacy-hourly",
                mintedShares,
                issuedSharesBefore,
                issuedSharesAfter,
                activeHolders,
                buyPressureDelta: 0,
                ownershipDriftBps: calculateOneShareOwnershipDriftBps({
                  issuedSharesBefore,
                  mintedShares,
                }),
              });

              issuedThisTick += mintedShares;
              issuanceEvents++;

              console.log(
                `${stock.companySymbol}: Issued ${mintedShares} share via legacy-hourly policy`,
              );
            }
          }

          if (
            issuancePolicy === "event-conditional" &&
            buyPressureTriggerEnabled
          ) {
            for (const stock of updatedStocks) {
              if (!stock.companyId) {
                continue;
              }

              const buyDelta = Number(stock.broughtToday || 0);
              const sellDelta = Number(stock.soldToday || 0);
              const netDemand = buyDelta - sellDelta;

              if (
                !shouldTriggerBuyPressureMint({
                  policy: issuancePolicy,
                  buyPressureTriggerEnabled,
                  netDemand,
                  buyPressureThreshold,
                })
              ) {
                continue;
              }

              const activeHoldersResult = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(userShares)
                .where(
                  and(
                    eq(userShares.companyId, stock.companyId),
                    gte(userShares.quantity, 1),
                  ),
                );

              const activeHolders = activeHoldersResult[0]?.count || 0;
              if (activeHolders <= 0) {
                continue;
              }

              const alreadyMintedResult = await db
                .select({
                  total: sql<number>`COALESCE(SUM(${shareIssuanceEvents.mintedShares}), 0)::int`,
                })
                .from(shareIssuanceEvents)
                .where(
                  and(
                    eq(shareIssuanceEvents.companyId, stock.companyId),
                    gte(shareIssuanceEvents.createdAt, dayStart),
                    lt(shareIssuanceEvents.createdAt, nextDayStart),
                  ),
                );

              const alreadyMintedToday = alreadyMintedResult[0]?.total || 0;
              if (alreadyMintedToday >= dailyMintCap) {
                continue;
              }

              const mintedShares = 1;
              const issuedSharesBefore = Number(stock.issuedShares || 0);
              const issuedSharesAfter = issuedSharesBefore + mintedShares;

              await db
                .update(companies)
                .set({ issuedShares: issuedSharesAfter })
                .where(eq(companies.id, stock.companyId));

              await db.insert(shareIssuanceEvents).values({
                companyId: stock.companyId,
                policy: issuancePolicy,
                source: "buy-pressure",
                mintedShares,
                issuedSharesBefore,
                issuedSharesAfter,
                activeHolders,
                buyPressureDelta: netDemand,
                ownershipDriftBps: calculateOneShareOwnershipDriftBps({
                  issuedSharesBefore,
                  mintedShares,
                }),
              });

              issuedThisTick += mintedShares;
              issuanceEvents++;

              console.log(
                `${stock.companySymbol}: Issued ${mintedShares} share via buy-pressure trigger (net demand ${netDemand})`,
              );
            }
          }

          // Update company CEOs to whoever has the most shares
          for (const stock of updatedStocks) {
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
          for (const stock of updatedStocks) {
            if (stock.companyId) {
              const holders = await db
                .select({ userId: userShares.userId })
                .from(userShares)
                .where(eq(userShares.companyId, stock.companyId))
                .limit(1);

              if (holders.length === 0) {
                // Cancel any open orders for this company and refund buy orders
                const openOrders = await db
                  .select()
                  .from(stockOrders)
                  .where(
                    and(
                      eq(stockOrders.companyId, stock.companyId),
                      or(
                        eq(stockOrders.status, "open"),
                        eq(stockOrders.status, "partial"),
                      ),
                    ),
                  );

                for (const order of openOrders) {
                  const remaining = order.quantity - order.filledQuantity;
                  if (order.side === "buy" && remaining > 0) {
                    const refund = remaining * order.pricePerShare;
                    await db
                      .update(users)
                      .set({ money: sql`${users.money} + ${refund}` })
                      .where(eq(users.id, order.userId));
                  }
                  await db
                    .update(stockOrders)
                    .set({ status: "cancelled", updatedAt: new Date() })
                    .where(eq(stockOrders.id, order.id));
                }

                // Remove order fills, price history, stock entry, then company
                await db
                  .delete(orderFills)
                  .where(eq(orderFills.companyId, stock.companyId));
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
          const activeStocks = updatedStocks.filter(
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

              const hourlyDividendPool = calculateHourlyDividendPool(marketCap);
              const dividendPerShareMilli = calculateDividendPerShareMilli({
                hourlyDividendPool,
                issuedShares,
              });

              await db.insert(financeKpiSnapshots).values({
                companyId: stock.companyId,
                policy: issuancePolicy,
                sharePrice: stock.price,
                issuedShares,
                marketCap,
                hourlyDividendPool,
                dividendPerShareMilli,
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
              message: `Updated ${updatedStocks.length} stock prices, matched ${totalSharesTraded} shares (${treasurySharesSold} from treasury), cancelled ${cancelledOrphanedOrders} orphaned orders, issued ${issuedThisTick} shares via ${issuanceEvents} events, paid $${dividendsPaid} in dividends, processed ${candidatesProcessed} candidates`,
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
