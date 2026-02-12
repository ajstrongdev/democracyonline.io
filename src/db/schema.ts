import {
  bigint,
  boolean,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  bio: text("bio"),
  politicalLeaning: varchar("political_leaning", { length: 50 }),
  role: varchar("role", { length: 50 }).default("Representative"),
  partyId: integer("party_id"),
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  lastActivity: bigint("last_activity", { mode: "number" }).default(0),
  money: bigint("money", { mode: "number" }).default(100),
});

// Parties table
export const parties = pgTable("parties", {
  id: serial("id").primaryKey(),
  leaderId: integer("leader_id"),
  name: varchar("name", { length: 255 }).notNull().unique(),
  color: varchar("color", { length: 7 }).notNull(),
  bio: text("bio"),
  politicalLeaning: varchar("political_leaning", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  leaning: varchar("leaning", { length: 25 }),
  logo: varchar("logo", { length: 100 }),
  discord: varchar("discord", { length: 255 }),
  partySubs: bigint("party_subs", { mode: "number" }).default(0),
  money: bigint("money", { mode: "number" }).default(0),
});

// Political stances table
export const politicalStances = pgTable("political_stances", {
  id: serial("id").primaryKey(),
  issue: varchar("issue", { length: 100 }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
});

// Party stances table
export const partyStances = pgTable("party_stances", {
  partyId: integer("party_id"),
  stanceId: integer("stance_id"),
  value: varchar("value", { length: 1024 }).notNull(),
});

// Merge request table
export const mergeRequest = pgTable("merge_request", {
  id: serial("id").primaryKey(),
  leaderId: integer("leader_id"),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 7 }).notNull(),
  bio: text("bio"),
  politicalLeaning: varchar("political_leaning", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  leaning: varchar("leaning", { length: 25 }).notNull(),
  logo: varchar("logo", { length: 100 }),
  partySubs: bigint("party_subs", { mode: "number" }).default(0),
});

// Merge request stances table
export const mergeRequestStances = pgTable("merge_request_stances", {
  id: serial("id").primaryKey(),
  mergeRequestId: integer("merge_request_id").notNull(),
  stanceId: integer("stance_id").notNull(),
  value: text("value"),
});

// Party notifications table
export const partyNotifications = pgTable(
  "party_notifications",
  {
    senderPartyId: integer("sender_party_id").notNull(),
    receiverPartyId: integer("receiver_party_id").notNull(),
    mergeRequestId: integer("merge_request_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    status: varchar("status", { length: 20 }).default("Pending").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [
        table.senderPartyId,
        table.receiverPartyId,
        table.mergeRequestId,
      ],
    }),
  }),
);

// Bills table
export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  status: varchar("status", { length: 50 }).default("Queued").notNull(),
  stage: varchar("stage", { length: 50 }).default("House").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  creatorId: integer("creator_id"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  pool: integer("pool"),
});

// Bill votes house table
export const billVotesHouse = pgTable("bill_votes_house", {
  id: serial("id").primaryKey(),
  billId: integer("bill_id"),
  voterId: integer("voter_id"),
  voteYes: boolean("vote_yes").notNull(),
});

// Bill votes senate table
export const billVotesSenate = pgTable("bill_votes_senate", {
  id: serial("id").primaryKey(),
  billId: integer("bill_id"),
  voterId: integer("voter_id"),
  voteYes: boolean("vote_yes").notNull(),
});

// Bill votes presidential table
export const billVotesPresidential = pgTable("bill_votes_presidential", {
  id: serial("id").primaryKey(),
  billId: integer("bill_id"),
  voterId: integer("voter_id"),
  voteYes: boolean("vote_yes").notNull(),
});

// Elections table
export const elections = pgTable("elections", {
  election: varchar("election", { length: 50 }).primaryKey(),
  status: varchar("status", { length: 50 }).default("Candidacy").notNull(),
  seats: integer("seats"),
  daysLeft: integer("days_left").notNull(),
});

// Candidates table
export const candidates = pgTable(
  "candidates",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    election: varchar("election", { length: 50 }),
    votes: integer("votes").default(0),
    votesPerHour: integer("votes_per_hour").default(0),
    donationsPerHour: integer("donations_per_hour").default(0),
    donations: bigint("donations", { mode: "number" }).default(0),
    haswon: boolean("haswon"),
  },
  (table) => ({
    userIdElectionUnique: unique().on(table.userId, table.election),
  }),
);

export const donationHistory = pgTable("donation_history", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id"),
  amount: bigint("amount", { mode: "number" }).notNull(),
  donator: integer("donator"),
  donatedAt: timestamp("donated_at").defaultNow(),
});

// Candidate snapshot table for hourly tracking
export const candidateSnapshots = pgTable("candidate_snapshots", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull(),
  election: varchar("election", { length: 50 }).notNull(),
  votes: integer("votes").default(0).notNull(),
  donations: bigint("donations", { mode: "number" }).default(0).notNull(),
  snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
});

// Transaction history table
export const transactionHistory = pgTable("transaction_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Party transaction history table
export const partyTransactionHistory = pgTable("party_transaction_history", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Items table
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  target: varchar("target", { length: 50 }).notNull(), // Donations or Votes per hour
  increaseAmount: bigint("increase_amount", { mode: "number" }).notNull(),
  baseCost: bigint("base_cost", { mode: "number" }).notNull(),
  costMultiplier: bigint("cost_multiplier", { mode: "number" })
    .default(30)
    .notNull(),
});

// Candidate purchases
export const candidatePurchases = pgTable("candidate_purchases", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull(),
  itemId: integer("item_id").notNull(),
  quantity: bigint("quantity", { mode: "number" }).default(0).notNull(),
  purchasedAt: timestamp("purchased_at").defaultNow(),
});

// Companies table
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull().unique(),
  description: text("description"),
  capital: bigint("capital", { mode: "number" }).default(0),
  issuedShares: bigint("issued_shares", { mode: "number" }).default(0),
  creatorId: integer("creator_id"),
  logo: varchar("logo", { length: 100 }),
  color: varchar("color", { length: 7 }).default("#3b82f6"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Stock market table
export const stocks = pgTable("stocks", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  price: bigint("price", { mode: "number" }).notNull(),
  broughtToday: bigint("brought_today", { mode: "number" }).default(0),
  soldToday: bigint("sold_today", { mode: "number" }).default(0),
});

// User shares (holdings) table
export const userShares = pgTable(
  "user_shares",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id),
    quantity: bigint("quantity", { mode: "number" }).default(0).notNull(),
    acquiredAt: timestamp("acquired_at").defaultNow(),
  },
  (table) => ({
    userCompanyUnique: unique().on(table.userId, table.companyId),
  }),
);

export const sharePriceHistory = pgTable("share_price_history", {
  id: serial("id").primaryKey(),
  stockId: integer("stock_id"),
  price: bigint("price", { mode: "number" }).notNull(),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// Remove this later
export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  voteType: varchar("vote_type", { length: 50 }).notNull(),
  candidateId: integer("candidate_id"),
});

// Senate election table
export const senateElection = pgTable("senate_election", {
  id: serial("id").primaryKey(),
  voterId: integer("voter_id"),
  candidateId: integer("candidate_id"),
  pointsWon: integer("points_won").notNull(),
});

// Presidential election table
export const presidentialElection = pgTable("presidential_election", {
  id: serial("id").primaryKey(),
  voterId: integer("voter_id"),
  candidateId: integer("candidate_id"),
  pointsWon: integer("points_won").notNull(),
});

// Chats table
export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  room: varchar("room", { length: 255 }).notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Feed table
export const feed = pgTable("feed", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Access tokens table
export const accessTokens = pgTable("access_tokens", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Game tracker table
export const gameTracker = pgTable("game_tracker", {
  id: serial("id").primaryKey(),
  billPool: integer("bill_pool").default(1).notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  party: one(parties, {
    fields: [users.partyId],
    references: [parties.id],
  }),
  bills: many(bills),
  candidates: many(candidates),
  chats: many(chats),
  feed: many(feed),
  billVotesHouse: many(billVotesHouse),
  billVotesSenate: many(billVotesSenate),
  billVotesPresidential: many(billVotesPresidential),
}));

export const partiesRelations = relations(parties, ({ one, many }) => ({
  leader: one(users, {
    fields: [parties.leaderId],
    references: [users.id],
  }),
  members: many(users),
  partyStances: many(partyStances),
  sentNotifications: many(partyNotifications, { relationName: "senderParty" }),
  receivedNotifications: many(partyNotifications, {
    relationName: "receiverParty",
  }),
  transactionHistory: many(partyTransactionHistory),
}));

export const partyTransactionHistoryRelations = relations(
  partyTransactionHistory,
  ({ one }) => ({
    party: one(parties, {
      fields: [partyTransactionHistory.partyId],
      references: [parties.id],
    }),
  }),
);

export const billsRelations = relations(bills, ({ one, many }) => ({
  creator: one(users, {
    fields: [bills.creatorId],
    references: [users.id],
  }),
  houseVotes: many(billVotesHouse),
  senateVotes: many(billVotesSenate),
  presidentialVotes: many(billVotesPresidential),
}));

export const billVotesHouseRelations = relations(billVotesHouse, ({ one }) => ({
  bill: one(bills, {
    fields: [billVotesHouse.billId],
    references: [bills.id],
  }),
  voter: one(users, {
    fields: [billVotesHouse.voterId],
    references: [users.id],
  }),
}));

export const billVotesSenateRelations = relations(
  billVotesSenate,
  ({ one }) => ({
    bill: one(bills, {
      fields: [billVotesSenate.billId],
      references: [bills.id],
    }),
    voter: one(users, {
      fields: [billVotesSenate.voterId],
      references: [users.id],
    }),
  }),
);

export const billVotesPresidentialRelations = relations(
  billVotesPresidential,
  ({ one }) => ({
    bill: one(bills, {
      fields: [billVotesPresidential.billId],
      references: [bills.id],
    }),
    voter: one(users, {
      fields: [billVotesPresidential.voterId],
      references: [users.id],
    }),
  }),
);

export const candidatesRelations = relations(candidates, ({ one, many }) => ({
  user: one(users, {
    fields: [candidates.userId],
    references: [users.id],
  }),
  election: one(elections, {
    fields: [candidates.election],
    references: [elections.election],
  }),
  purchases: many(candidatePurchases),
}));

export const electionsRelations = relations(elections, ({ many }) => ({
  candidates: many(candidates),
}));

export const partyStancesRelations = relations(partyStances, ({ one }) => ({
  party: one(parties, {
    fields: [partyStances.partyId],
    references: [parties.id],
  }),
  stance: one(politicalStances, {
    fields: [partyStances.stanceId],
    references: [politicalStances.id],
  }),
}));

export const politicalStancesRelations = relations(
  politicalStances,
  ({ many }) => ({
    partyStances: many(partyStances),
    mergeRequestStances: many(mergeRequestStances),
  }),
);

export const mergeRequestRelations = relations(mergeRequest, ({ many }) => ({
  stances: many(mergeRequestStances),
  notifications: many(partyNotifications),
}));

export const mergeRequestStancesRelations = relations(
  mergeRequestStances,
  ({ one }) => ({
    mergeRequest: one(mergeRequest, {
      fields: [mergeRequestStances.mergeRequestId],
      references: [mergeRequest.id],
    }),
    stance: one(politicalStances, {
      fields: [mergeRequestStances.stanceId],
      references: [politicalStances.id],
    }),
  }),
);

export const partyNotificationsRelations = relations(
  partyNotifications,
  ({ one }) => ({
    senderParty: one(parties, {
      fields: [partyNotifications.senderPartyId],
      references: [parties.id],
      relationName: "senderParty",
    }),
    receiverParty: one(parties, {
      fields: [partyNotifications.receiverPartyId],
      references: [parties.id],
      relationName: "receiverParty",
    }),
    mergeRequest: one(mergeRequest, {
      fields: [partyNotifications.mergeRequestId],
      references: [mergeRequest.id],
    }),
  }),
);

export const chatsRelations = relations(chats, ({ one }) => ({
  user: one(users, {
    fields: [chats.userId],
    references: [users.id],
  }),
}));

export const feedRelations = relations(feed, ({ one }) => ({
  user: one(users, {
    fields: [feed.userId],
    references: [users.id],
  }),
}));

export const itemsRelations = relations(items, ({ many }) => ({
  purchases: many(candidatePurchases),
}));

export const candidatePurchasesRelations = relations(
  candidatePurchases,
  ({ one }) => ({
    candidate: one(candidates, {
      fields: [candidatePurchases.candidateId],
      references: [candidates.id],
    }),
    item: one(items, {
      fields: [candidatePurchases.itemId],
      references: [items.id],
    }),
  }),
);
