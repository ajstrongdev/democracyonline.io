import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db";
import {
  companies,
  stocks,
  users,
  transactionHistory,
  userShares,
  sharePriceHistory,
} from "@/db/schema";
import { requireAuthMiddleware } from "@/middleware";
import { eq, and, desc } from "drizzle-orm";
import {
  CreateCompanySchema,
  UpdateCompanySchema,
} from "@/lib/schemas/stock-schema";

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
      creatorUsername: users.username,
      logo: companies.logo,
      color: companies.color,
      createdAt: companies.createdAt,
      stockId: stocks.id,
      stockPrice: stocks.price,
    })
    .from(companies)
    .leftJoin(stocks, eq(stocks.companyId, companies.id))
    .leftJoin(users, eq(companies.creatorId, users.id));

  return companiesWithStocks;
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
    const issuedShares = Math.floor(data.capital / 100);
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
        stockPrice: stocks.price,
      })
      .from(companies)
      .leftJoin(stocks, eq(stocks.companyId, companies.id))
      .where(eq(companies.id, data.companyId))
      .limit(1);

    return company || null;
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

    // Check if user owns shares in this company (has control)
    const [ownership] = await db
      .select({ quantity: userShares.quantity })
      .from(userShares)
      .where(
        and(
          eq(userShares.userId, currentUser.id),
          eq(userShares.companyId, data.companyId),
        ),
      )
      .limit(1);

    if (!ownership || (ownership.quantity || 0) === 0) {
      throw new Error("Only shareholders can update the company");
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
  .inputValidator((data: { companyId: number; quantity?: number }) => data)
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

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, data.companyId))
      .limit(1);

    if (!company) {
      throw new Error("Company not found");
    }

    const [stock] = await db
      .select()
      .from(stocks)
      .where(eq(stocks.companyId, company.id))
      .limit(1);

    if (!stock) {
      throw new Error("Stock not found for company");
    }

    const sharePrice = stock.price;
    const totalCost = sharePrice * quantity;
    if ((currentUser.money || 0) < totalCost) {
      throw new Error(
        `Insufficient funds to buy ${quantity} share${quantity > 1 ? "s" : ""}`,
      );
    }

    // Check if shares are available
    const allUserShares = await db
      .select()
      .from(userShares)
      .where(eq(userShares.companyId, company.id));

    const totalSharesOwned = allUserShares.reduce(
      (sum, share) => sum + (share.quantity || 0),
      0,
    );

    const availableShares = (company.issuedShares || 0) - totalSharesOwned;

    if (availableShares < quantity) {
      throw new Error(
        `Only ${availableShares} share${availableShares !== 1 ? "s" : ""} available for purchase`,
      );
    }

    // Deduct money from user
    await db
      .update(users)
      .set({ money: (currentUser.money || 0) - totalCost })
      .where(eq(users.id, currentUser.id));

    // Add shares to userShares
    const [existingShare] = await db
      .select()
      .from(userShares)
      .where(
        and(
          eq(userShares.userId, currentUser.id),
          eq(userShares.companyId, company.id),
        ),
      )
      .limit(1);

    if (existingShare) {
      await db
        .update(userShares)
        .set({ quantity: existingShare.quantity + quantity })
        .where(eq(userShares.id, existingShare.id));
    } else {
      await db.insert(userShares).values({
        userId: currentUser.id,
        companyId: company.id,
        quantity: quantity,
      });
    }

    // Update stocks tracking
    await db
      .update(stocks)
      .set({ broughtToday: (stock?.broughtToday || 0) + quantity })
      .where(eq(stocks.id, stock.id));

    // Update transaction history
    await db.insert(transactionHistory).values({
      userId: currentUser.id,
      description: `Bought ${quantity} share${quantity > 1 ? "s" : ""} of ${company.name} (${company.symbol}) for $${totalCost.toLocaleString()}`,
    });
  });

// Sell shares
export const sellShares = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { companyId: number; quantity: number }) => data)
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

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, data.companyId))
      .limit(1);

    if (!company) {
      throw new Error("Company not found");
    }

    const [stock] = await db
      .select()
      .from(stocks)
      .where(eq(stocks.companyId, company.id))
      .limit(1);

    if (!stock) {
      throw new Error("Stock not found for company");
    }

    const [userShare] = await db
      .select()
      .from(userShares)
      .where(
        and(
          eq(userShares.userId, currentUser.id),
          eq(userShares.companyId, company.id),
        ),
      )
      .limit(1);

    if (
      !userShare ||
      userShare.quantity < data.quantity ||
      data.quantity <= 0
    ) {
      throw new Error("Not enough shares to sell");
    }

    const totalValue = stock.price * data.quantity;

    // Update user balance
    await db
      .update(users)
      .set({ money: (currentUser.money || 0) + totalValue })
      .where(eq(users.id, currentUser.id));

    // Update or delete userShares
    if (userShare.quantity === data.quantity) {
      await db.delete(userShares).where(eq(userShares.id, userShare.id));
    } else {
      await db
        .update(userShares)
        .set({ quantity: userShare.quantity - data.quantity })
        .where(eq(userShares.id, userShare.id));
    }

    // Update stocks tracking
    await db
      .update(stocks)
      .set({ soldToday: (stock?.soldToday || 0) + data.quantity })
      .where(eq(stocks.id, stock.id));

    // Update transaction history
    await db.insert(transactionHistory).values({
      userId: currentUser.id,
      description: `Sold ${data.quantity} share${data.quantity > 1 ? "s" : ""} of ${company.name} (${company.symbol}) for $${totalValue.toLocaleString()}`,
    });

    return { success: true };
  });

// CEO investment to issue more shares
export const investInCompany = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator(
    (data: {
      companyId: number;
      investmentAmount: number;
      retainedShares: number;
    }) => data,
  )
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

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, data.companyId))
      .limit(1);

    if (!company) {
      throw new Error("Company not found");
    }

    const [stock] = await db
      .select()
      .from(stocks)
      .where(eq(stocks.companyId, company.id))
      .limit(1);

    if (!stock) {
      throw new Error("Stock not found for company");
    }

    const sharePrice = stock.price;

    if (data.investmentAmount < sharePrice) {
      throw new Error(`Investment must be at least $${sharePrice} (1 share)`);
    }

    // Check if user has enough money
    if ((currentUser.money || 0) < data.investmentAmount) {
      throw new Error("Insufficient funds for investment");
    }

    // Calculate new shares to issue: 1 share per share price
    const newShares = Math.floor(data.investmentAmount / sharePrice);
    const newCapital = (company.capital || 0) + data.investmentAmount;
    const newTotalShares = (company.issuedShares || 0) + newShares;

    // Validate retained shares
    if (data.retainedShares > newShares) {
      throw new Error("Cannot retain more shares than are being issued");
    }

    // Update company
    await db
      .update(companies)
      .set({
        capital: newCapital,
        issuedShares: newTotalShares,
      })
      .where(eq(companies.id, company.id));

    // Deduct money from CEO
    await db
      .update(users)
      .set({ money: (currentUser.money || 0) - data.investmentAmount })
      .where(eq(users.id, currentUser.id));

    // Add retained shares to CEO's holdings
    if (data.retainedShares > 0) {
      const existingShares = await db
        .select()
        .from(userShares)
        .where(
          and(
            eq(userShares.userId, currentUser.id),
            eq(userShares.companyId, company.id),
          ),
        )
        .limit(1);

      if (existingShares.length > 0) {
        // Update existing holding
        await db
          .update(userShares)
          .set({
            quantity: existingShares[0].quantity + data.retainedShares,
          })
          .where(eq(userShares.id, existingShares[0].id));
      } else {
        // Create new holding
        await db.insert(userShares).values({
          userId: currentUser.id,
          companyId: company.id,
          quantity: data.retainedShares,
        });
      }
    }

    // Recalculate and update share price based on new capital and shares
    const newSharePrice = Math.floor(newCapital / newTotalShares);
    await db
      .update(stocks)
      .set({ price: newSharePrice })
      .where(eq(stocks.id, stock.id));

    // Log price change in history
    await db.insert(sharePriceHistory).values({
      stockId: stock.id,
      price: newSharePrice,
    });

    // Record transaction
    await db.insert(transactionHistory).values({
      userId: currentUser.id,
      description: `Invested $${data.investmentAmount.toLocaleString()} in ${company.name}, issued ${newShares} new shares${data.retainedShares > 0 ? ` (retained ${data.retainedShares})` : ""}`,
    });

    return {
      success: true,
      newShares,
      newTotalShares,
      newCapital,
      newSharePrice,
      retainedShares: data.retainedShares,
    };
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
    const ceoCompanies = await db
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
      .where(eq(companies.creatorId, data.userId));

    // Calculate dividends for each company
    const companiesWithDividends = ceoCompanies.map((company) => {
      const marketCap = (company.stockPrice || 0) * (company.issuedShares || 0);
      const hourlyDividend = Math.floor(marketCap * 0.01); // 1% per hour
      const dailyDividend = hourlyDividend * 24;

      return {
        ...company,
        marketCap,
        hourlyDividend,
        dailyDividend,
      };
    });

    return companiesWithDividends;
  });
