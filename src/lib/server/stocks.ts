import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, asc, desc, eq, gte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
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
import { requireAuthMiddleware } from "@/middleware";
import {
  CreateCompanySchema,
  UpdateCompanySchema,
} from "@/lib/schemas/stock-schema";
import {
  calculateDividendPerShareMilli,
  calculateHourlyDividendPool,
  calculateOneShareOwnershipDriftBps,
} from "@/lib/utils/share-issuance-policy";
import {
  calculateHourlyDividend,
  calculateIssuedSharesFromCapital,
  calculateMarketCap,
} from "@/lib/utils/stock-economy";
import { env } from "@/env";
import {
  nonNegativeQuantitySchema,
  positiveMoneyAmountSchema,
  positiveQuantitySchema,
} from "@/lib/schemas/finance-schema";

const MAX_OPEN_ORDER_SHARES_PER_COMPANY = 5;

const BuySharesInputSchema = z.object({
  companyId: z.number().int().positive(),
  quantity: positiveQuantitySchema
    .max(
      MAX_OPEN_ORDER_SHARES_PER_COMPANY,
      `Cannot order more than ${MAX_OPEN_ORDER_SHARES_PER_COMPANY} shares at once`,
    )
    .optional()
    .default(1),
});

const SellSharesInputSchema = z.object({
  companyId: z.number().int().positive(),
  quantity: positiveQuantitySchema.max(
    MAX_OPEN_ORDER_SHARES_PER_COMPANY,
    `Cannot order more than ${MAX_OPEN_ORDER_SHARES_PER_COMPANY} shares at once`,
  ),
});

const InvestInCompanyInputSchema = z.object({
  companyId: z.number().int().positive(),
  investmentAmount: positiveMoneyAmountSchema,
  retainedShares: nonNegativeQuantitySchema,
});

// Helper: find the CEO of a company (top shareholder by shares)
async function getCompanyCEOId(companyId: number): Promise<number | null> {
  const [topHolder] = await db
    .select({ userId: userShares.userId })
    .from(userShares)
    .where(eq(userShares.companyId, companyId))
    .orderBy(desc(userShares.quantity))
    .limit(1);
  return topHolder?.userId ?? null;
}

export const getCompanies = createServerFn().handler(async () => {
  const companiesWithStocks = await db
    .select({
      id: companies.id,
      name: companies.name,
      symbol: companies.symbol,
      description: companies.description,
      capital: companies.capital,
      issuedShares: companies.issuedShares,
      creatorId: companies.creatorId,
      logo: companies.logo,
      color: companies.color,
      createdAt: companies.createdAt,
      stockId: stocks.id,
      stockPrice: stocks.price,
    })
    .from(companies)
    .leftJoin(stocks, eq(stocks.companyId, companies.id));

  const companiesWithAvailability = await Promise.all(
    companiesWithStocks.map(async (company) => {
      const allHoldings = await db
        .select({ userId: userShares.userId, quantity: userShares.quantity })
        .from(userShares)
        .where(eq(userShares.companyId, company.id));

      const totalOwned = allHoldings.reduce(
        (sum, h) => sum + (h.quantity || 0),
        0,
      );
      const available = (company.issuedShares || 0) - totalOwned;

      // Sum open/partial sell orders for this company
      const [sellOrderResult] = await db
        .select({
          totalForSale: sql<number>`COALESCE(SUM(${stockOrders.quantity} - ${stockOrders.filledQuantity}), 0)`,
        })
        .from(stockOrders)
        .where(
          and(
            eq(stockOrders.companyId, company.id),
            eq(stockOrders.side, "sell"),
            or(
              eq(stockOrders.status, "open"),
              eq(stockOrders.status, "partial"),
            ),
          ),
        );
      const sellOrderShares = Number(sellOrderResult?.totalForSale ?? 0);

      // Sum open/partial buy orders for this company
      const [buyOrderResult] = await db
        .select({
          totalBuying: sql<number>`COALESCE(SUM(${stockOrders.quantity} - ${stockOrders.filledQuantity}), 0)`,
        })
        .from(stockOrders)
        .where(
          and(
            eq(stockOrders.companyId, company.id),
            eq(stockOrders.side, "buy"),
            or(
              eq(stockOrders.status, "open"),
              eq(stockOrders.status, "partial"),
            ),
          ),
        );
      const buyOrderShares = Number(buyOrderResult?.totalBuying ?? 0);

      // CEO = top shareholder
      const topHolder = allHoldings.sort(
        (a, b) => (b.quantity || 0) - (a.quantity || 0),
      )[0];
      let creatorUsername: string | null = null;
      if (topHolder) {
        const [ceoUser] = await db
          .select({ username: users.username })
          .from(users)
          .where(eq(users.id, topHolder.userId))
          .limit(1);
        creatorUsername = ceoUser?.username || null;
      }

      return {
        ...company,
        availableShares: available,
        sellOrderShares,
        buyOrderShares,
        creatorUsername,
      };
    }),
  );

  return companiesWithAvailability;
});

export const getSharePriceHistory = createServerFn().handler(async () => {
  // Fetch the latest recorded timestamp to anchor the 48-hour window.
  // This accounts for synthetic future timestamps from rapid dev advances.
  const [latest] = await db
    .select({ recordedAt: sharePriceHistory.recordedAt })
    .from(sharePriceHistory)
    .orderBy(desc(sharePriceHistory.recordedAt))
    .limit(1);

  const latestTime = latest?.recordedAt
    ? new Date(latest.recordedAt).getTime()
    : Date.now();
  const cutoff = new Date(latestTime - 48 * 60 * 60 * 1000);

  const history = await db
    .select({
      id: sharePriceHistory.id,
      stockId: sharePriceHistory.stockId,
      price: sharePriceHistory.price,
      recordedAt: sharePriceHistory.recordedAt,
      companyName: companies.name,
      companySymbol: companies.symbol,
      companyColor: companies.color,
    })
    .from(sharePriceHistory)
    .innerJoin(stocks, eq(sharePriceHistory.stockId, stocks.id))
    .innerJoin(companies, eq(stocks.companyId, companies.id))
    .where(gte(sharePriceHistory.recordedAt, cutoff))
    .orderBy(desc(sharePriceHistory.recordedAt))
    .limit(2000);

  return history;
});

export const createCompany = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(CreateCompanySchema)
  .handler(async ({ context, data }) => {
    if (!context.user?.email) {
      throw new Error("Unauthorized");
    }

    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, context.user.email))
      .limit(1);

    if (!currentUser) {
      throw new Error("User not found");
    }

    if ((currentUser.money || 0) < data.capital) {
      throw new Error("Insufficient funds for startup capital");
    }

    // Rate limit: 1 company creation per 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentCreation] = await db
      .select({ id: transactionHistory.id })
      .from(transactionHistory)
      .where(
        and(
          eq(transactionHistory.userId, currentUser.id),
          gte(transactionHistory.createdAt, twentyFourHoursAgo),
          sql`${transactionHistory.description} LIKE 'Created company %'`,
        ),
      )
      .limit(1);

    if (recentCreation) {
      throw new Error(
        "You can only create one company every 24 hours. Please wait before creating another.",
      );
    }

    const existingCompany = await db
      .select()
      .from(companies)
      .where(eq(companies.symbol, data.symbol))
      .limit(1);

    if (existingCompany.length > 0) {
      throw new Error("Stock symbol already exists");
    }

    // Only issue the shares the founder actually retains — no unowned stock
    const issuedShares = data.retainedShares;
    const initialSharePrice = 100; // $100 per share

    // Validate retained shares don't exceed what capital could theoretically support
    const maxPossibleShares = calculateIssuedSharesFromCapital(data.capital);
    if (data.retainedShares > maxPossibleShares) {
      throw new Error(
        `Cannot retain more than ${maxPossibleShares} shares with $${data.capital.toLocaleString()} capital`,
      );
    }

    const [newCompany] = await db
      .insert(companies)
      .values({
        name: data.name,
        symbol: data.symbol.toUpperCase(),
        description: data.description || null,
        capital: data.capital,
        issuedShares: issuedShares,
        creatorId: currentUser.id,
        logo: data.logo || null,
        color: data.color || "#3b82f6",
      })
      .returning();

    await db.insert(stocks).values({
      companyId: newCompany.id,
      price: initialSharePrice,
      broughtToday: 0,
      soldToday: 0,
    });

    const [newStock] = await db
      .select()
      .from(stocks)
      .where(eq(stocks.companyId, newCompany.id))
      .limit(1);

    // Log initial price in history
    await db.insert(sharePriceHistory).values({
      stockId: newStock.id,
      price: initialSharePrice,
    });

    if (data.retainedShares > 0) {
      await db.insert(userShares).values({
        userId: currentUser.id,
        companyId: newCompany.id,
        quantity: data.retainedShares,
      });
    }

    await db
      .update(users)
      .set({ money: (currentUser.money || 0) - data.capital })
      .where(eq(users.id, currentUser.id));

    // Record the transaction
    const retainedText =
      data.retainedShares > 0 ? `, retained ${data.retainedShares} shares` : "";
    await db.insert(transactionHistory).values({
      userId: currentUser.id,
      description: `Created company ${data.name} (${data.symbol}) with $${data.capital.toLocaleString()} capital${retainedText}`,
    });

    return {
      success: true,
      company: newCompany,
      sharesIssued: issuedShares,
      sharesRetained: data.retainedShares,
      sharesAvailable: 0,
    };
  });

export const getCompanyById = createServerFn()
  .inputValidator((data: { companyId: number }) => data)
  .handler(async ({ data }) => {
    const [company] = await db
      .select({
        id: companies.id,
        name: companies.name,
        symbol: companies.symbol,
        description: companies.description,
        capital: companies.capital,
        issuedShares: companies.issuedShares,
        logo: companies.logo,
        color: companies.color,
        createdAt: companies.createdAt,
        creatorId: companies.creatorId,
        stockPrice: stocks.price,
      })
      .from(companies)
      .leftJoin(stocks, eq(stocks.companyId, companies.id))
      .where(eq(companies.id, data.companyId))
      .limit(1);

    if (!company) return null;

    // Calculate total shares owned by all users
    const allHoldings = await db
      .select({ quantity: userShares.quantity })
      .from(userShares)
      .where(eq(userShares.companyId, company.id));

    const totalOwnedShares = allHoldings.reduce(
      (sum, h) => sum + (h.quantity || 0),
      0,
    );

    // CEO = top shareholder
    const ceoId = await getCompanyCEOId(company.id);

    return { ...company, totalOwnedShares, ceoId };
  });

export const updateCompany = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator(UpdateCompanySchema)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) {
      throw new Error("Authentication required");
    }

    const [currentUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, context.user.email))
      .limit(1);

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Check if user is the CEO (top shareholder) of this company
    const ceoId = await getCompanyCEOId(data.companyId);

    if (!ceoId) {
      throw new Error("Company has no shareholders");
    }

    if (ceoId !== currentUser.id) {
      throw new Error("Only the CEO can edit the company");
    }

    await db
      .update(companies)
      .set({
        name: data.name,
        description: data.description || null,
        logo: data.logo || null,
        color: data.color,
      })
      .where(eq(companies.id, data.companyId));

    return { success: true };
  });

// Get user's shares (holdings)
export const getUserShares = createServerFn()
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    if (!context.user?.email) {
      throw new Error("Unauthorized");
    }

    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, context.user.email))
      .limit(1);

    if (!currentUser) {
      throw new Error("User not found");
    }

    const holdings = await db
      .select({
        id: userShares.id,
        quantity: userShares.quantity,
        acquiredAt: userShares.acquiredAt,
        companyId: companies.id,
        companyName: companies.name,
        companySymbol: companies.symbol,
        companyLogo: companies.logo,
        companyColor: companies.color,
        stockPrice: stocks.price,
      })
      .from(userShares)
      .innerJoin(companies, eq(userShares.companyId, companies.id))
      .leftJoin(stocks, eq(stocks.companyId, companies.id))
      .where(eq(userShares.userId, currentUser.id));

    return holdings;
  });

export const buyShares = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: unknown) => BuySharesInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const quantity = data.quantity || 1;

    if (!context.user?.email) {
      throw new Error("Unauthorized");
    }

    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, context.user.email))
      .limit(1);

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Place a buy order instead of instant purchase
    return db.transaction(async (tx) => {
      const [company] = await tx
        .select()
        .from(companies)
        .where(eq(companies.id, data.companyId))
        .limit(1);

      if (!company) {
        throw new Error("Company not found");
      }

      const [stock] = await tx
        .select()
        .from(stocks)
        .where(eq(stocks.companyId, company.id))
        .limit(1);

      if (!stock) {
        throw new Error("Stock not found for company");
      }

      // Get current game hour
      const [currentGameState] = await tx
        .select({ currentGameHour: gameState.currentGameHour })
        .from(gameState)
        .limit(1);
      const currentGameHour = currentGameState?.currentGameHour ?? 0;

      // Rate limit: 1 buy order per game hour (only active orders count)
      const [recentBuyOrder] = await tx
        .select({ id: stockOrders.id })
        .from(stockOrders)
        .where(
          and(
            eq(stockOrders.userId, currentUser.id),
            eq(stockOrders.side, "buy"),
            eq(stockOrders.gameHour, currentGameHour),
            or(
              eq(stockOrders.status, "open"),
              eq(stockOrders.status, "partial"),
            ),
          ),
        )
        .limit(1);

      if (recentBuyOrder) {
        throw new Error(
          "You can only place one buy order per game hour. Wait for the next hourly tick.",
        );
      }

      // Cap: max 5 shares in open buy orders per company
      const [pendingBuyResult] = await tx
        .select({
          pending: sql<number>`COALESCE(SUM(${stockOrders.quantity} - ${stockOrders.filledQuantity}), 0)`,
        })
        .from(stockOrders)
        .where(
          and(
            eq(stockOrders.userId, currentUser.id),
            eq(stockOrders.companyId, company.id),
            eq(stockOrders.side, "buy"),
            or(
              eq(stockOrders.status, "open"),
              eq(stockOrders.status, "partial"),
            ),
          ),
        );

      const pendingBuyShares = Number(pendingBuyResult?.pending || 0);
      if (pendingBuyShares + quantity > MAX_OPEN_ORDER_SHARES_PER_COMPANY) {
        const remaining = MAX_OPEN_ORDER_SHARES_PER_COMPANY - pendingBuyShares;
        throw new Error(
          remaining <= 0
            ? `You already have ${pendingBuyShares} share${pendingBuyShares !== 1 ? "s" : ""} pending in buy orders for this company (max ${MAX_OPEN_ORDER_SHARES_PER_COMPANY})`
            : `You can only order ${remaining} more share${remaining !== 1 ? "s" : ""} for this company (${pendingBuyShares} already pending, max ${MAX_OPEN_ORDER_SHARES_PER_COMPANY})`,
        );
      }

      const pricePerShare = stock.price;
      const totalCost = pricePerShare * quantity;

      // Check user has enough funds to place the order
      if ((currentUser.money || 0) < totalCost) {
        throw new Error(
          `Insufficient funds. Need $${totalCost.toLocaleString()}, have $${(currentUser.money || 0).toLocaleString()}`,
        );
      }

      // Deduct funds immediately (escrow)
      await tx
        .update(users)
        .set({ money: sql`${users.money} - ${totalCost}` })
        .where(
          and(
            eq(users.id, currentUser.id),
            sql`${users.money} >= ${totalCost}`,
          ),
        );

      // Create the buy order
      const [order] = await tx
        .insert(stockOrders)
        .values({
          userId: currentUser.id,
          companyId: company.id,
          side: "buy",
          quantity,
          filledQuantity: 0,
          pricePerShare,
          status: "open",
          gameHour: currentGameHour,
        })
        .returning();

      await tx.insert(transactionHistory).values({
        userId: currentUser.id,
        description: `Placed buy order for ${quantity} share${quantity > 1 ? "s" : ""} of ${company.name} (${company.symbol}) at $${pricePerShare.toLocaleString()}/share (total $${totalCost.toLocaleString()} escrowed)`,
      });

      return { success: true, orderId: order.id };
    });
  });

// Sell shares - places a sell order
export const sellShares = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: unknown) => SellSharesInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    if (!context.user?.email) {
      throw new Error("Unauthorized");
    }

    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, context.user.email))
      .limit(1);

    if (!currentUser) {
      throw new Error("User not found");
    }

    return db.transaction(async (tx) => {
      const [company] = await tx
        .select()
        .from(companies)
        .where(eq(companies.id, data.companyId))
        .limit(1);

      if (!company) {
        throw new Error("Company not found");
      }

      const [stock] = await tx
        .select()
        .from(stocks)
        .where(eq(stocks.companyId, company.id))
        .limit(1);

      if (!stock) {
        throw new Error("Stock not found for company");
      }

      // Get current game hour
      const [currentGameState] = await tx
        .select({ currentGameHour: gameState.currentGameHour })
        .from(gameState)
        .limit(1);
      const currentGameHour = currentGameState?.currentGameHour ?? 0;

      // Rate limit: 1 sell order per game hour (only active orders count)
      const [recentSellOrder] = await tx
        .select({ id: stockOrders.id })
        .from(stockOrders)
        .where(
          and(
            eq(stockOrders.userId, currentUser.id),
            eq(stockOrders.side, "sell"),
            eq(stockOrders.gameHour, currentGameHour),
            or(
              eq(stockOrders.status, "open"),
              eq(stockOrders.status, "partial"),
            ),
          ),
        )
        .limit(1);

      if (recentSellOrder) {
        throw new Error(
          "You can only place one sell order per game hour. Wait for the next hourly tick.",
        );
      }

      // Check the user has enough shares (accounting for shares already in open sell orders)
      const [holding] = await tx
        .select({ quantity: userShares.quantity })
        .from(userShares)
        .where(
          and(
            eq(userShares.userId, currentUser.id),
            eq(userShares.companyId, company.id),
          ),
        )
        .limit(1);

      const ownedShares = holding?.quantity || 0;

      // Calculate shares already locked in open/partial sell orders
      const [lockedResult] = await tx
        .select({
          locked: sql<number>`COALESCE(SUM(${stockOrders.quantity} - ${stockOrders.filledQuantity}), 0)`,
        })
        .from(stockOrders)
        .where(
          and(
            eq(stockOrders.userId, currentUser.id),
            eq(stockOrders.companyId, company.id),
            eq(stockOrders.side, "sell"),
            or(
              eq(stockOrders.status, "open"),
              eq(stockOrders.status, "partial"),
            ),
          ),
        );

      const lockedShares = Number(lockedResult?.locked || 0);
      const availableToSell = ownedShares - lockedShares;

      if (availableToSell < data.quantity) {
        throw new Error(
          `Only ${availableToSell} share${availableToSell !== 1 ? "s" : ""} available to sell (${lockedShares} locked in pending orders)`,
        );
      }

      // Cap: max 5 shares in open sell orders per company
      if (lockedShares + data.quantity > MAX_OPEN_ORDER_SHARES_PER_COMPANY) {
        const remaining = MAX_OPEN_ORDER_SHARES_PER_COMPANY - lockedShares;
        throw new Error(
          remaining <= 0
            ? `You already have ${lockedShares} share${lockedShares !== 1 ? "s" : ""} in pending sell orders for this company (max ${MAX_OPEN_ORDER_SHARES_PER_COMPANY})`
            : `You can only sell ${remaining} more share${remaining !== 1 ? "s" : ""} for this company (${lockedShares} already pending, max ${MAX_OPEN_ORDER_SHARES_PER_COMPANY})`,
        );
      }

      // Create the sell order (no money given yet - only on fill)
      const [order] = await tx
        .insert(stockOrders)
        .values({
          userId: currentUser.id,
          companyId: company.id,
          side: "sell",
          quantity: data.quantity,
          filledQuantity: 0,
          pricePerShare: stock.price,
          status: "open",
          gameHour: currentGameHour,
        })
        .returning();

      await tx.insert(transactionHistory).values({
        userId: currentUser.id,
        description: `Placed sell order for ${data.quantity} share${data.quantity > 1 ? "s" : ""} of ${company.name} (${company.symbol}) at $${stock.price.toLocaleString()}/share`,
      });

      return { success: true, orderId: order.id };
    });
  });

// Get user's open/pending orders
export const getUserOrders = createServerFn()
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    if (!context.user?.email) {
      throw new Error("Unauthorized");
    }

    const [currentUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, context.user.email))
      .limit(1);

    if (!currentUser) {
      throw new Error("User not found");
    }

    const orders = await db
      .select({
        id: stockOrders.id,
        companyId: stockOrders.companyId,
        side: stockOrders.side,
        quantity: stockOrders.quantity,
        filledQuantity: stockOrders.filledQuantity,
        pricePerShare: stockOrders.pricePerShare,
        status: stockOrders.status,
        createdAt: stockOrders.createdAt,
        companyName: companies.name,
        companySymbol: companies.symbol,
        companyLogo: companies.logo,
        companyColor: companies.color,
      })
      .from(stockOrders)
      .innerJoin(companies, eq(stockOrders.companyId, companies.id))
      .where(eq(stockOrders.userId, currentUser.id))
      .orderBy(desc(stockOrders.createdAt));

    return orders;
  });

// Cancel an open order
export const cancelOrder = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: unknown) =>
    z.object({ orderId: z.number().int().positive() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    if (!context.user?.email) {
      throw new Error("Unauthorized");
    }

    const [currentUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, context.user.email))
      .limit(1);

    if (!currentUser) {
      throw new Error("User not found");
    }

    return db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(stockOrders)
        .where(
          and(
            eq(stockOrders.id, data.orderId),
            eq(stockOrders.userId, currentUser.id),
          ),
        )
        .limit(1);

      if (!order) {
        throw new Error("Order not found");
      }

      if (order.status !== "open" && order.status !== "partial") {
        throw new Error(
          "Only open or partially filled orders can be cancelled",
        );
      }

      const remainingQty = order.quantity - order.filledQuantity;

      // If it's a buy order, refund the escrowed money for unfilled shares
      if (order.side === "buy") {
        const refund = remainingQty * order.pricePerShare;
        await tx
          .update(users)
          .set({ money: sql`${users.money} + ${refund}` })
          .where(eq(users.id, currentUser.id));
      }

      await tx
        .update(stockOrders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(stockOrders.id, order.id));

      const [company] = await tx
        .select({ name: companies.name, symbol: companies.symbol })
        .from(companies)
        .where(eq(companies.id, order.companyId))
        .limit(1);

      await tx.insert(transactionHistory).values({
        userId: currentUser.id,
        description: `Cancelled ${order.side} order for ${remainingQty} share${remainingQty > 1 ? "s" : ""} of ${company?.name || "Unknown"} (${company?.symbol || "?"})${order.side === "buy" ? ` — $${(remainingQty * order.pricePerShare).toLocaleString()} refunded` : ""}`,
      });

      return { success: true };
    });
  });

// Get the order book for a company (individual orders with player names, FIFO)
export const getCompanyOrderBook = createServerFn()
  .inputValidator((data: { companyId: number }) => data)
  .handler(async ({ data }) => {
    const openBuyOrders = await db
      .select({
        id: stockOrders.id,
        pricePerShare: stockOrders.pricePerShare,
        quantity: stockOrders.quantity,
        filledQuantity: stockOrders.filledQuantity,
        remaining: sql<number>`(${stockOrders.quantity} - ${stockOrders.filledQuantity})::int`,
        status: stockOrders.status,
        createdAt: stockOrders.createdAt,
        username: users.username,
        userId: stockOrders.userId,
      })
      .from(stockOrders)
      .innerJoin(users, eq(users.id, stockOrders.userId))
      .where(
        and(
          eq(stockOrders.companyId, data.companyId),
          eq(stockOrders.side, "buy"),
          or(eq(stockOrders.status, "open"), eq(stockOrders.status, "partial")),
        ),
      )
      .orderBy(asc(stockOrders.createdAt));

    const openSellOrders = await db
      .select({
        id: stockOrders.id,
        pricePerShare: stockOrders.pricePerShare,
        quantity: stockOrders.quantity,
        filledQuantity: stockOrders.filledQuantity,
        remaining: sql<number>`(${stockOrders.quantity} - ${stockOrders.filledQuantity})::int`,
        status: stockOrders.status,
        createdAt: stockOrders.createdAt,
        username: users.username,
        userId: stockOrders.userId,
      })
      .from(stockOrders)
      .innerJoin(users, eq(users.id, stockOrders.userId))
      .where(
        and(
          eq(stockOrders.companyId, data.companyId),
          eq(stockOrders.side, "sell"),
          or(eq(stockOrders.status, "open"), eq(stockOrders.status, "partial")),
        ),
      )
      .orderBy(asc(stockOrders.pricePerShare), asc(stockOrders.createdAt));

    // Recent fills
    const recentFills = await db
      .select({
        quantity: orderFills.quantity,
        pricePerShare: orderFills.pricePerShare,
        filledAt: orderFills.filledAt,
      })
      .from(orderFills)
      .where(eq(orderFills.companyId, data.companyId))
      .orderBy(desc(orderFills.filledAt))
      .limit(20);

    return {
      bids: openBuyOrders,
      asks: openSellOrders,
      recentFills,
    };
  });

// CEO investment to issue more shares
export const investInCompany = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: unknown) => InvestInCompanyInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    if (!context.user?.email) {
      throw new Error("Unauthorized");
    }

    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, context.user.email))
      .limit(1);

    if (!currentUser) {
      throw new Error("User not found");
    }

    return db.transaction(async (tx) => {
      const [company] = await tx
        .select()
        .from(companies)
        .where(eq(companies.id, data.companyId))
        .limit(1);

      if (!company) {
        throw new Error("Company not found");
      }

      await tx.execute(
        sql`SELECT id FROM companies WHERE id = ${company.id} FOR UPDATE`,
      );

      const [stock] = await tx
        .select()
        .from(stocks)
        .where(eq(stocks.companyId, company.id))
        .limit(1);

      if (!stock) {
        throw new Error("Stock not found for company");
      }

      const [topHolder] = await tx
        .select({ userId: userShares.userId })
        .from(userShares)
        .where(eq(userShares.companyId, company.id))
        .orderBy(desc(userShares.quantity))
        .limit(1);

      if (topHolder?.userId !== currentUser.id) {
        throw new Error("Only the CEO can invest to issue new shares");
      }

      const currentCapital = Number(company.capital || 0);
      const currentShares = Number(company.issuedShares || 0);
      const sharePrice = Number(stock.price);

      if (sharePrice <= 0) {
        throw new Error("Invalid share price");
      }

      // Only issue shares the CEO actually retains — no unowned stock
      const newShares = data.retainedShares;
      const actualCost = newShares * sharePrice;

      if (newShares <= 0) {
        throw new Error("Must retain at least 1 share");
      }

      // Validate the investment covers the cost
      if (data.investmentAmount < actualCost) {
        throw new Error(
          `Investment must be at least $${actualCost.toLocaleString()} to retain ${newShares} share${newShares > 1 ? "s" : ""}`,
        );
      }

      const deductedRows = await tx
        .update(users)
        .set({ money: sql`${users.money} - ${actualCost}` })
        .where(
          and(
            eq(users.id, currentUser.id),
            sql`${users.money} >= ${actualCost}`,
          ),
        )
        .returning({ id: users.id });

      if (deductedRows.length === 0) {
        throw new Error("Insufficient funds for investment");
      }

      const activeHoldersResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(userShares)
        .where(
          and(
            eq(userShares.companyId, company.id),
            sql`${userShares.quantity} >= 1`,
          ),
        );

      const activeHolders = activeHoldersResult[0]?.count || 0;

      if (activeHolders <= 0) {
        throw new Error("Cannot issue shares when no active holders exist");
      }

      if (env.SHARE_ISSUANCE_POLICY === "event-conditional") {
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const nextDayStart = new Date(dayStart);
        nextDayStart.setDate(nextDayStart.getDate() + 1);

        const alreadyMintedResult = await tx
          .select({
            total: sql<number>`COALESCE(SUM(${shareIssuanceEvents.mintedShares}), 0)::int`,
          })
          .from(shareIssuanceEvents)
          .where(
            and(
              eq(shareIssuanceEvents.companyId, company.id),
              sql`${shareIssuanceEvents.createdAt} >= ${dayStart}`,
              sql`${shareIssuanceEvents.createdAt} < ${nextDayStart}`,
            ),
          );

        const alreadyMintedToday = alreadyMintedResult[0]?.total || 0;
        const remainingMint = env.DAILY_COMPANY_MINT_CAP - alreadyMintedToday;

        if (newShares > remainingMint) {
          throw new Error(
            `Daily mint cap exceeded. Remaining allowance: ${Math.max(remainingMint, 0)} share(s)`,
          );
        }
      }

      const newCapital = currentCapital + actualCost;
      const newTotalShares = currentShares + newShares;

      await tx
        .update(companies)
        .set({
          capital: newCapital,
          issuedShares: newTotalShares,
        })
        .where(eq(companies.id, company.id));

      if (data.retainedShares > 0) {
        await tx
          .insert(userShares)
          .values({
            userId: currentUser.id,
            companyId: company.id,
            quantity: data.retainedShares,
          })
          .onConflictDoUpdate({
            target: [userShares.userId, userShares.companyId],
            set: {
              quantity: sql`${userShares.quantity} + ${data.retainedShares}`,
            },
          });
      }

      await tx.insert(sharePriceHistory).values({
        stockId: stock.id,
        price: sharePrice,
      });

      await tx.insert(transactionHistory).values({
        userId: currentUser.id,
        description: `Invested $${actualCost.toLocaleString()} in ${company.name}, issued ${newShares} new shares${data.retainedShares > 0 ? ` (retained ${data.retainedShares})` : ""}`,
      });

      await tx.insert(shareIssuanceEvents).values({
        companyId: company.id,
        policy: env.SHARE_ISSUANCE_POLICY,
        source: "investment",
        mintedShares: newShares,
        issuedSharesBefore: currentShares,
        issuedSharesAfter: newTotalShares,
        activeHolders,
        buyPressureDelta: 0,
        ownershipDriftBps: calculateOneShareOwnershipDriftBps({
          issuedSharesBefore: currentShares,
          mintedShares: newShares,
        }),
      });

      const marketCap = calculateMarketCap({
        sharePrice,
        issuedShares: newTotalShares,
      });
      const hourlyDividendPool = calculateHourlyDividendPool(marketCap);
      const dividendPerShareMilli = calculateDividendPerShareMilli({
        hourlyDividendPool,
        issuedShares: newTotalShares,
      });

      await tx.insert(financeKpiSnapshots).values({
        companyId: company.id,
        policy: env.SHARE_ISSUANCE_POLICY,
        sharePrice,
        issuedShares: newTotalShares,
        marketCap,
        hourlyDividendPool,
        dividendPerShareMilli,
      });

      return {
        success: true,
        newShares,
        newTotalShares,
        newCapital,
        newSharePrice: sharePrice,
        retainedShares: data.retainedShares,
      };
    });
  });

export const getCompanyStakeholders = createServerFn()
  .inputValidator((data: { companyId: number }) => data)
  .handler(async ({ data }) => {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, data.companyId))
      .limit(1);

    if (!company) {
      throw new Error("Company not found");
    }

    const stakeholders = await db
      .select({
        userId: users.id,
        username: users.username,
        shares: userShares.quantity,
      })
      .from(userShares)
      .innerJoin(users, eq(userShares.userId, users.id))
      .where(eq(userShares.companyId, data.companyId));

    // Calculate percentages
    const totalShares = company.issuedShares || 0;
    const stakeholdersWithPercentage = stakeholders.map((s) => ({
      ...s,
      percentage: totalShares > 0 ? (s.shares / totalShares) * 100 : 0,
    }));

    // Sort by shares owned (descending)
    stakeholdersWithPercentage.sort((a, b) => b.shares - a.shares);

    return stakeholdersWithPercentage;
  });

export const getUserCEOCompanies = createServerFn()
  .inputValidator((data: { userId: number }) => data)
  .handler(async ({ data }) => {
    // Get all companies where this user holds shares
    const userHoldings = await db
      .select({ companyId: userShares.companyId })
      .from(userShares)
      .where(eq(userShares.userId, data.userId));

    // Filter to companies where this user is the top shareholder (CEO)
    const ceoCompanies = [];
    for (const holding of userHoldings) {
      const ceoId = await getCompanyCEOId(holding.companyId);
      if (ceoId === data.userId) {
        const [company] = await db
          .select({
            id: companies.id,
            name: companies.name,
            symbol: companies.symbol,
            logo: companies.logo,
            color: companies.color,
            capital: companies.capital,
            issuedShares: companies.issuedShares,
            stockPrice: stocks.price,
          })
          .from(companies)
          .leftJoin(stocks, eq(stocks.companyId, companies.id))
          .where(eq(companies.id, holding.companyId))
          .limit(1);
        if (company) ceoCompanies.push(company);
      }
    }

    return ceoCompanies;
  });

// Get all companies a user holds shares in with dividend breakdown
export const getUserDividendCompanies = createServerFn()
  .inputValidator((data: { userId: number }) => data)
  .handler(async ({ data }) => {
    // Get all shares held by this user
    const holdings = await db
      .select({
        companyId: userShares.companyId,
        quantity: userShares.quantity,
      })
      .from(userShares)
      .where(eq(userShares.userId, data.userId));

    if (holdings.length === 0) return [];

    const result = await Promise.all(
      holdings.map(async (holding) => {
        const [company] = await db
          .select({
            id: companies.id,
            name: companies.name,
            symbol: companies.symbol,
            logo: companies.logo,
            color: companies.color,
            capital: companies.capital,
            issuedShares: companies.issuedShares,
            creatorId: companies.creatorId,
            stockPrice: stocks.price,
          })
          .from(companies)
          .leftJoin(stocks, eq(stocks.companyId, companies.id))
          .where(eq(companies.id, holding.companyId))
          .limit(1);

        if (!company) return null;

        // Get total owned shares across all users
        const allHoldings = await db
          .select({ quantity: userShares.quantity })
          .from(userShares)
          .where(eq(userShares.companyId, company.id));

        const totalOwnedShares = allHoldings.reduce(
          (sum, h) => sum + (h.quantity || 0),
          0,
        );

        const userShares_ = holding.quantity || 0;
        const issuedShares = company.issuedShares || 0;
        const ownershipPct = issuedShares > 0 ? userShares_ / issuedShares : 0;
        const marketCap = calculateMarketCap({
          sharePrice: company.stockPrice,
          issuedShares,
        });
        const hourlyDividend = calculateHourlyDividend({
          ownershipPct,
          marketCap,
        });
        const dailyDividend = hourlyDividend * 24;

        return {
          ...company,
          sharesOwned: userShares_,
          totalOwnedShares,
          ownershipPct,
          marketCap,
          hourlyDividend,
          dailyDividend,
          isCEO: (await getCompanyCEOId(company.id)) === data.userId,
        };
      }),
    );

    return result.filter(Boolean) as Array<
      NonNullable<(typeof result)[number]>
    >;
  });
