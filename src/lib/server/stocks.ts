import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/db";
import {
  companies,
  financeKpiSnapshots,
  shareIssuanceEvents,
  stocks,
  users,
  transactionHistory,
  userShares,
  sharePriceHistory,
} from "@/db/schema";
import { requireAuthMiddleware } from "@/middleware";
import { eq, and, desc, sql } from "drizzle-orm";
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

const BuySharesInputSchema = z.object({
  companyId: z.number().int().positive(),
  quantity: positiveQuantitySchema.optional().default(1),
});

const SellSharesInputSchema = z.object({
  companyId: z.number().int().positive(),
  quantity: positiveQuantitySchema,
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

      return { ...company, availableShares: available, creatorUsername };
    }),
  );

  return companiesWithAvailability;
});

export const getSharePriceHistory = createServerFn().handler(async () => {
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
    .orderBy(desc(sharePriceHistory.recordedAt))
    .limit(500);

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

    const existingCompany = await db
      .select()
      .from(companies)
      .where(eq(companies.symbol, data.symbol))
      .limit(1);

    if (existingCompany.length > 0) {
      throw new Error("Stock symbol already exists");
    }

    // Calculate issued shares: 1 share per $100 capital
    const issuedShares = calculateIssuedSharesFromCapital(data.capital);
    const initialSharePrice = 100; // $100 per share

    if (data.retainedShares > issuedShares) {
      throw new Error("Cannot retain more shares than will be issued");
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
      sharesAvailable: issuedShares - data.retainedShares,
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

    await db.transaction(async (tx) => {
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

      const sharePrice = stock.price;
      const totalCost = sharePrice * quantity;

      const [sharesAggregate] = await tx
        .select({
          totalOwned: sql<number>`COALESCE(SUM(${userShares.quantity}), 0)`,
        })
        .from(userShares)
        .where(eq(userShares.companyId, company.id));

      const totalSharesOwned = Number(sharesAggregate?.totalOwned || 0);
      const availableShares =
        Number(company.issuedShares || 0) - totalSharesOwned;

      if (availableShares < quantity) {
        throw new Error(
          `Only ${availableShares} share${availableShares !== 1 ? "s" : ""} available for purchase`,
        );
      }

      const deductedRows = await tx
        .update(users)
        .set({ money: sql`${users.money} - ${totalCost}` })
        .where(
          and(
            eq(users.id, currentUser.id),
            sql`${users.money} >= ${totalCost}`,
          ),
        )
        .returning({ id: users.id });

      if (deductedRows.length === 0) {
        throw new Error(
          `Insufficient funds to buy ${quantity} share${quantity > 1 ? "s" : ""}`,
        );
      }

      await tx
        .insert(userShares)
        .values({
          userId: currentUser.id,
          companyId: company.id,
          quantity,
        })
        .onConflictDoUpdate({
          target: [userShares.userId, userShares.companyId],
          set: {
            quantity: sql`${userShares.quantity} + ${quantity}`,
          },
        });

      await tx
        .update(stocks)
        .set({
          broughtToday: sql`COALESCE(${stocks.broughtToday}, 0) + ${quantity}`,
        })
        .where(eq(stocks.id, stock.id));

      await tx.insert(transactionHistory).values({
        userId: currentUser.id,
        description: `Bought ${quantity} share${quantity > 1 ? "s" : ""} of ${company.name} (${company.symbol}) for $${totalCost.toLocaleString()}`,
      });
    });
  });

// Sell shares
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

      const updatedShareRows = await tx
        .update(userShares)
        .set({ quantity: sql`${userShares.quantity} - ${data.quantity}` })
        .where(
          and(
            eq(userShares.userId, currentUser.id),
            eq(userShares.companyId, company.id),
            sql`${userShares.quantity} >= ${data.quantity}`,
          ),
        )
        .returning({ id: userShares.id, quantity: userShares.quantity });

      if (updatedShareRows.length === 0) {
        throw new Error("Not enough shares to sell");
      }

      const updatedShare = updatedShareRows[0];

      if (updatedShare.quantity === 0) {
        await tx.delete(userShares).where(eq(userShares.id, updatedShare.id));
      }

      const totalValue = stock.price * data.quantity;

      await tx
        .update(users)
        .set({ money: sql`${users.money} + ${totalValue}` })
        .where(eq(users.id, currentUser.id));

      await tx
        .update(stocks)
        .set({
          soldToday: sql`COALESCE(${stocks.soldToday}, 0) + ${data.quantity}`,
        })
        .where(eq(stocks.id, stock.id));

      await tx.insert(transactionHistory).values({
        userId: currentUser.id,
        description: `Sold ${data.quantity} share${data.quantity > 1 ? "s" : ""} of ${company.name} (${company.symbol}) for $${totalValue.toLocaleString()}`,
      });

      return { success: true };
    });
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

      if (data.investmentAmount < sharePrice) {
        throw new Error(`Investment must be at least $${sharePrice} (1 share)`);
      }

      const newShares = Math.floor(data.investmentAmount / sharePrice);
      const actualCost = newShares * sharePrice;

      if (data.retainedShares > newShares) {
        throw new Error("Cannot retain more shares than are being issued");
      }

      if (data.retainedShares < 0) {
        throw new Error("Retained shares cannot be negative");
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

    return result.filter(Boolean) as NonNullable<(typeof result)[number]>[];
  });
