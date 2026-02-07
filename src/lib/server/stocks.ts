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
      logo: companies.logo,
      color: companies.color,
      createdAt: companies.createdAt,
      stockId: stocks.id,
      stockPrice: stocks.price,
    })
    .from(companies)
    .leftJoin(stocks, eq(stocks.companyId, companies.id));

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
  .inputValidator((data: { companyId: number }) => data)
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
    if ((currentUser.money || 0) < sharePrice) {
      throw new Error("Insufficient funds to buy share");
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

    if (
      company.issuedShares == null ||
      totalSharesOwned >= company.issuedShares
    ) {
      throw new Error("No shares available for purchase");
    }

    // Deduct money from user
    await db
      .update(users)
      .set({ money: (currentUser.money || 0) - sharePrice })
      .where(eq(users.id, currentUser.id));

    // Add share to userShares
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
        .set({ quantity: existingShare.quantity + 1 })
        .where(eq(userShares.id, existingShare.id));
    } else {
      await db.insert(userShares).values({
        userId: currentUser.id,
        companyId: company.id,
        quantity: 1,
      });
    }

    // Update stocks tracking
    await db
      .update(stocks)
      .set({ broughtToday: (stock?.broughtToday || 0) + 1 })
      .where(eq(stocks.id, stock.id));

    // Update transaction history
    await db.insert(transactionHistory).values({
      userId: currentUser.id,
      description: `Bought 1 share of ${company.name} (${company.symbol}) for $${sharePrice.toLocaleString()}`,
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
