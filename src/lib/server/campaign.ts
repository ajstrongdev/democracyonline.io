import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { candidatePurchases, candidates, elections, items } from "@/db/schema";
import { requireAuthMiddleware } from "@/middleware/auth";

// Types
export type CampaignData = {
  candidateId: number;
  election: string;
  votes: number;
  donations: number;
  votesPerHour: number;
  donationsPerHour: number;
  electionStatus: string;
  daysLeft: number;
};

export type CampaignItem = {
  id: number;
  name: string;
  description: string;
  target: string;
  increaseAmount: number;
  baseCost: number;
  costMultiplier: number;
  owned: number;
  currentCost: number;
};

// Get campaign data for a candidate
export const getCampaignData = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { userId: number }) => data)
  .handler(async ({ data }): Promise<CampaignData | null> => {
    // Get candidate info
    const [candidate] = await db
      .select({
        id: candidates.id,
        election: candidates.election,
        votes: candidates.votes,
        donations: candidates.donations,
        votesPerHour: candidates.votesPerHour,
        donationsPerHour: candidates.donationsPerHour,
      })
      .from(candidates)
      .where(eq(candidates.userId, data.userId))
      .limit(1);

    if (!candidate || !candidate.election) {
      return null;
    }

    // Get election status
    const [electionInfo] = await db
      .select({
        status: elections.status,
        daysLeft: elections.daysLeft,
      })
      .from(elections)
      .where(eq(elections.election, candidate.election))
      .limit(1);

    if (!electionInfo) {
      return null;
    }

    return {
      candidateId: candidate.id,
      election: candidate.election,
      votes: candidate.votes || 0,
      donations: Number(candidate.donations) || 0,
      votesPerHour: candidate.votesPerHour || 0,
      donationsPerHour: candidate.donationsPerHour || 0,
      electionStatus: electionInfo.status,
      daysLeft: electionInfo.daysLeft,
    };
  });

// Get available items with purchase counts
export const getCampaignItems = createServerFn()
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { candidateId: number }) => data)
  .handler(async ({ data }): Promise<Array<CampaignItem>> => {
    // Get all items
    const allItems = await db.select().from(items);

    // Get purchases for this candidate
    const purchases = await db
      .select({
        itemId: candidatePurchases.itemId,
        quantity: candidatePurchases.quantity,
      })
      .from(candidatePurchases)
      .where(eq(candidatePurchases.candidateId, data.candidateId));

    const purchaseMap = new Map<number, number>();
    purchases.forEach((p) => {
      purchaseMap.set(p.itemId, Number(p.quantity) || 0);
    });

    return allItems.map((item) => {
      const owned = purchaseMap.get(item.id) || 0;
      // Calculate current cost: baseCost * (1 + costMultiplier/100)^owned
      const multiplier = 1 + Number(item.costMultiplier) / 100;
      const currentCost = Math.floor(
        Number(item.baseCost) * Math.pow(multiplier, owned),
      );

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        target: item.target,
        increaseAmount: Number(item.increaseAmount),
        baseCost: Number(item.baseCost),
        costMultiplier: Number(item.costMultiplier),
        owned,
        currentCost,
      };
    });
  });

// Purchase an item
export const purchaseCampaignItem = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((data: { candidateId: number; itemId: number }) => data)
  .handler(async ({ data }) => {
    // Get the item
    const [item] = await db
      .select()
      .from(items)
      .where(eq(items.id, data.itemId))
      .limit(1);

    if (!item) {
      throw new Error("Item not found");
    }

    // Get candidate's current donations
    const [candidate] = await db
      .select({
        donations: candidates.donations,
        votesPerHour: candidates.votesPerHour,
        donationsPerHour: candidates.donationsPerHour,
      })
      .from(candidates)
      .where(eq(candidates.id, data.candidateId))
      .limit(1);

    if (!candidate) {
      throw new Error("Candidate not found");
    }

    // Get current ownership count
    const [existingPurchase] = await db
      .select({ quantity: candidatePurchases.quantity })
      .from(candidatePurchases)
      .where(
        and(
          eq(candidatePurchases.candidateId, data.candidateId),
          eq(candidatePurchases.itemId, data.itemId),
        ),
      )
      .limit(1);

    const owned = existingPurchase ? Number(existingPurchase.quantity) : 0;

    // Calculate current cost
    const multiplier = 1 + Number(item.costMultiplier) / 100;
    const currentCost = Math.floor(
      Number(item.baseCost) * Math.pow(multiplier, owned),
    );

    // Check if candidate has enough donations
    if (Number(candidate.donations) < currentCost) {
      throw new Error("Not enough campaign funds");
    }

    // Deduct cost from donations
    await db
      .update(candidates)
      .set({
        donations: sql`${candidates.donations} - ${currentCost}`,
        ...(item.target === "Votes"
          ? {
              votesPerHour: sql`${candidates.votesPerHour} + ${item.increaseAmount}`,
            }
          : {
              donationsPerHour: sql`${candidates.donationsPerHour} + ${item.increaseAmount}`,
            }),
      })
      .where(eq(candidates.id, data.candidateId));

    // Update or insert purchase record
    if (existingPurchase) {
      await db
        .update(candidatePurchases)
        .set({
          quantity: sql`${candidatePurchases.quantity} + 1`,
          purchasedAt: new Date(),
        })
        .where(
          and(
            eq(candidatePurchases.candidateId, data.candidateId),
            eq(candidatePurchases.itemId, data.itemId),
          ),
        );
    } else {
      await db.insert(candidatePurchases).values({
        candidateId: data.candidateId,
        itemId: data.itemId,
        quantity: 1,
      });
    }

    return { success: true, cost: currentCost };
  });

export const seedCampaignItems = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    // Check if items already exist
    const existingItems = await db.select().from(items);
    if (existingItems.length > 0) {
      return { success: true, message: "Items already exist" };
    }

    // Seed items - mix of vote and donation generators
    const seedItems = [
      // Donation generators (low tier)
      {
        name: "Lemonade Stand",
        description:
          "A humble beginning. Sell lemonade to raise funds for your campaign.",
        target: "Donations",
        increaseAmount: 5,
        baseCost: 10,
        costMultiplier: 15,
      },
      {
        name: "Bake Sale",
        description: "Homemade cookies and cakes bring in the donations.",
        target: "Donations",
        increaseAmount: 15,
        baseCost: 50,
        costMultiplier: 18,
      },
      {
        name: "Merchandise Booth",
        description: "Sell campaign t-shirts, hats, and bumper stickers.",
        target: "Donations",
        increaseAmount: 40,
        baseCost: 200,
        costMultiplier: 20,
      },
      {
        name: "Online Crowdfunding",
        description: "Set up a crowdfunding page to reach donors nationwide.",
        target: "Donations",
        increaseAmount: 100,
        baseCost: 500,
        costMultiplier: 22,
      },
      {
        name: "Fundraising Dinner",
        description: "Host exclusive dinners for wealthy donors.",
        target: "Donations",
        increaseAmount: 250,
        baseCost: 1500,
        costMultiplier: 25,
      },
      {
        name: "Corporate Sponsor",
        description: "Partner with businesses who support your platform.",
        target: "Donations",
        increaseAmount: 750,
        baseCost: 5000,
        costMultiplier: 28,
      },
      {
        name: "Super PAC Connection",
        description:
          "Connect with political action committees for major fundraising.",
        target: "Donations",
        increaseAmount: 2000,
        baseCost: 15000,
        costMultiplier: 30,
      },
      {
        name: "Billionaire Endorsement",
        description: "Gain the backing of a wealthy tycoon.",
        target: "Donations",
        increaseAmount: 5000,
        baseCost: 50000,
        costMultiplier: 32,
      },

      // Vote generators (low tier)
      {
        name: "Campaign Flyers",
        description: "Hand out flyers in your neighborhood to spread the word.",
        target: "Votes",
        increaseAmount: 1,
        baseCost: 15,
        costMultiplier: 15,
      },
      {
        name: "Door-to-Door Canvassing",
        description: "Hire volunteers to knock on doors and talk to voters.",
        target: "Votes",
        increaseAmount: 3,
        baseCost: 75,
        costMultiplier: 18,
      },
      {
        name: "Town Hall Meeting",
        description: "Host public meetings to engage with citizens.",
        target: "Votes",
        increaseAmount: 8,
        baseCost: 250,
        costMultiplier: 20,
      },
      {
        name: "Local Radio Ads",
        description: "Run advertisements on local radio stations.",
        target: "Votes",
        increaseAmount: 20,
        baseCost: 600,
        costMultiplier: 22,
      },
      {
        name: "Newspaper Endorsement",
        description: "Secure endorsements from local newspapers.",
        target: "Votes",
        increaseAmount: 50,
        baseCost: 1800,
        costMultiplier: 25,
      },
      {
        name: "TV Commercial",
        description: "Air campaign commercials on local television.",
        target: "Votes",
        increaseAmount: 150,
        baseCost: 6000,
        costMultiplier: 28,
      },
      {
        name: "Celebrity Endorsement",
        description:
          "Get a famous celebrity to publicly support your campaign.",
        target: "Votes",
        increaseAmount: 400,
        baseCost: 18000,
        costMultiplier: 30,
      },
      {
        name: "Viral Social Media Campaign",
        description: "Launch a social media blitz that goes viral nationwide.",
        target: "Votes",
        increaseAmount: 1000,
        baseCost: 60000,
        costMultiplier: 32,
      },

      // High-tier hybrid/special items
      {
        name: "Political Rally",
        description:
          "Organize massive rallies that energize your base and attract media coverage.",
        target: "Votes",
        increaseAmount: 2500,
        baseCost: 150000,
        costMultiplier: 35,
      },
      {
        name: "Debate Prep Team",
        description:
          "Hire expert coaches to dominate debates and win over undecided voters.",
        target: "Votes",
        increaseAmount: 5000,
        baseCost: 400000,
        costMultiplier: 38,
      },
      {
        name: "National Media Tour",
        description:
          "Appear on major news networks and talk shows across the country.",
        target: "Votes",
        increaseAmount: 10000,
        baseCost: 1000000,
        costMultiplier: 40,
      },
      {
        name: "International Charity Event",
        description:
          "Host a high-profile charity gala that attracts worldwide attention.",
        target: "Donations",
        increaseAmount: 12500,
        baseCost: 200000,
        costMultiplier: 35,
      },
      {
        name: "Hedge Fund Alliance",
        description: "Form partnerships with major financial institutions.",
        target: "Donations",
        increaseAmount: 25000,
        baseCost: 500000,
        costMultiplier: 38,
      },
      {
        name: "Tech Industry Summit",
        description:
          "Court Silicon Valley billionaires with promises of innovation.",
        target: "Donations",
        increaseAmount: 50000,
        baseCost: 1200000,
        costMultiplier: 40,
      },
    ];

    await db.insert(items).values(seedItems);

    return { success: true, message: "Items seeded successfully" };
  });
