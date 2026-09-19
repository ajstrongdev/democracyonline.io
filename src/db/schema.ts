import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

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

// Coalitions table
export const coalitions = pgTable("coalitions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  color: varchar("color", { length: 7 }).notNull(),
  logo: varchar("logo", { length: 255 }),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coalitionMembers = pgTable(
  "coalition_members",
  {
    coalitionId: integer("coalition_id").notNull(),
    partyId: integer("party_id").notNull(),
    joinDate: timestamp("join_date").defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.coalitionId, table.partyId],
    }),
  ],
);

export const joinRequests = pgTable("join_requests", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id").notNull(),
  coalitionId: integer("coalition_id").notNull(),
  status: varchar("status", { length: 20 }).default("Pending").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

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
  status: varchar("status", { length: 50 }).default("Candidate").notNull(),
  seats: integer("seats"),
  daysLeft: integer("days_left").notNull(),
  cycle: integer("cycle").default(1).notNull(),
});

// Immutable election records. Names and affiliations are denormalized so the
// historical record survives profile, membership, and party changes.
export const electionHistory = pgTable(
  "election_history",
  {
    id: serial("id").primaryKey(),
    election: varchar("election", { length: 50 }).notNull(),
    cycle: integer("cycle").notNull(),
    seats: integer("seats"),
    totalBallots: integer("total_ballots").default(0).notNull(),
    totalPoints: integer("total_points").default(0).notNull(),
    concludedAt: timestamp("concluded_at").defaultNow().notNull(),
  },
  (table) => [
    unique("election_history_election_cycle_unique").on(
      table.election,
      table.cycle,
    ),
    index("election_history_concluded_at_idx").on(table.concludedAt),
  ],
);

export const electionCandidateHistory = pgTable(
  "election_candidate_history",
  {
    id: serial("id").primaryKey(),
    electionHistoryId: integer("election_history_id")
      .notNull()
      .references(() => electionHistory.id, { onDelete: "cascade" }),
    userId: integer("user_id"),
    username: varchar("username", { length: 255 }).notNull(),
    partyId: integer("party_id"),
    partyName: varchar("party_name", { length: 255 }),
    partyColor: varchar("party_color", { length: 7 }),
    points: integer("points").default(0).notNull(),
    firstPreferenceVotes: integer("first_preference_votes")
      .default(0)
      .notNull(),
    placement: integer("placement").notNull(),
    elected: boolean("elected").default(false).notNull(),
  },
  (table) => [
    unique("election_candidate_history_result_unique").on(
      table.electionHistoryId,
      table.userId,
    ),
    index("election_candidate_history_user_idx").on(table.userId),
  ],
);

export const electionOfficeholderHistory = pgTable(
  "election_officeholder_history",
  {
    id: serial("id").primaryKey(),
    electionHistoryId: integer("election_history_id")
      .notNull()
      .references(() => electionHistory.id, { onDelete: "cascade" }),
    userId: integer("user_id"),
    username: varchar("username", { length: 255 }).notNull(),
    partyId: integer("party_id"),
    partyName: varchar("party_name", { length: 255 }),
    partyColor: varchar("party_color", { length: 7 }),
    office: varchar("office", { length: 50 }).notNull(),
    selection: varchar("selection", { length: 50 }).notNull(),
  },
  (table) => [
    unique("election_officeholder_history_member_unique").on(
      table.electionHistoryId,
      table.userId,
      table.office,
    ),
    index("election_officeholder_history_user_idx").on(table.userId),
  ],
);

export const archivedParties = pgTable("archived_parties", {
  partyId: integer("party_id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 7 }).notNull(),
  bio: text("bio"),
  politicalLeaning: varchar("political_leaning", { length: 50 }),
  leaning: varchar("leaning", { length: 25 }),
  logo: varchar("logo", { length: 100 }),
  discord: varchar("discord", { length: 255 }),
  createdAt: timestamp("created_at"),
  archivedAt: timestamp("archived_at").defaultNow().notNull(),
});

export const partyMembershipEvents = pgTable(
  "party_membership_events",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    username: varchar("username", { length: 255 }).notNull(),
    office: varchar("office", { length: 50 }).notNull(),
    fromPartyId: integer("from_party_id"),
    fromPartyName: varchar("from_party_name", { length: 255 }),
    fromPartyColor: varchar("from_party_color", { length: 7 }),
    toPartyId: integer("to_party_id"),
    toPartyName: varchar("to_party_name", { length: 255 }),
    toPartyColor: varchar("to_party_color", { length: 7 }),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  },
  (table) => [
    index("party_membership_events_user_idx").on(table.userId),
    index("party_membership_events_from_party_idx").on(table.fromPartyId),
    index("party_membership_events_to_party_idx").on(table.toPartyId),
    index("party_membership_events_occurred_at_idx").on(table.occurredAt),
  ],
);

export const wikiArticles = pgTable(
  "wiki_articles",
  {
    id: serial("id").primaryKey(),
    entityType: varchar("entity_type", { length: 30 }).notNull(),
    entityId: varchar("entity_id", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("wiki_articles_entity_unique").on(table.entityType, table.entityId),
  ],
);

export const wikiArticleRevisions = pgTable(
  "wiki_article_revisions",
  {
    id: serial("id").primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .references(() => wikiArticles.id, { onDelete: "cascade" }),
    editorUserId: integer("editor_user_id"),
    editorUsername: varchar("editor_username", { length: 255 }).notNull(),
    content: text("content").notNull(),
    editSummary: varchar("edit_summary", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("wiki_article_revisions_article_idx").on(
      table.articleId,
      table.createdAt,
    ),
  ],
);

// Candidates table
export const candidates = pgTable(
  "candidates",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    election: varchar("election", { length: 50 }),
    votes: integer("votes").default(0),
    haswon: boolean("haswon"),
  },
  (table) => ({
    userIdElectionUnique: unique().on(table.userId, table.election),
  }),
);

// Primary candidates - players declaring in their party/coalition primary
export const primaryCandidates = pgTable(
  "primary_candidates",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    partyId: integer("party_id").notNull(),
    /** If the party is in a coalition, this is set so the whole coalition votes together */
    coalitionId: integer("coalition_id"),
    votes: integer("votes").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userUnique: unique().on(table.userId),
  }),
);

// Primary votes - one vote per user per primary cycle
export const primaryVotes = pgTable(
  "primary_votes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    candidateId: integer("candidate_id")
      .notNull()
      .references(() => primaryCandidates.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userUnique: unique().on(table.userId),
  }),
);

export const votes = pgTable(
  "votes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    voteType: varchar("vote_type", { length: 50 }).notNull(),
    candidateId: integer("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "restrict" }),
    rank: integer("rank").notNull(),
    points: integer("points").notNull(),
  },
  (table) => ({
    voterCandidateUnique: unique().on(
      table.userId,
      table.voteType,
      table.candidateId,
    ),
    voterRankUnique: unique().on(table.userId, table.voteType, table.rank),
    rankPositive: check("votes_rank_positive", sql`${table.rank} > 0`),
    pointsPositive: check("votes_points_positive", sql`${table.points} > 0`),
  }),
);

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
}));

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

export const candidatesRelations = relations(candidates, ({ one }) => ({
  user: one(users, {
    fields: [candidates.userId],
    references: [users.id],
  }),
  election: one(elections, {
    fields: [candidates.election],
    references: [elections.election],
  }),
}));

export const electionsRelations = relations(elections, ({ many }) => ({
  candidates: many(candidates),
}));

export const electionHistoryRelations = relations(
  electionHistory,
  ({ many }) => ({
    candidates: many(electionCandidateHistory),
    officeholders: many(electionOfficeholderHistory),
  }),
);

export const electionCandidateHistoryRelations = relations(
  electionCandidateHistory,
  ({ one }) => ({
    election: one(electionHistory, {
      fields: [electionCandidateHistory.electionHistoryId],
      references: [electionHistory.id],
    }),
  }),
);

export const electionOfficeholderHistoryRelations = relations(
  electionOfficeholderHistory,
  ({ one }) => ({
    election: one(electionHistory, {
      fields: [electionOfficeholderHistory.electionHistoryId],
      references: [electionHistory.id],
    }),
  }),
);

export const wikiArticlesRelations = relations(wikiArticles, ({ many }) => ({
  revisions: many(wikiArticleRevisions),
}));

export const wikiArticleRevisionsRelations = relations(
  wikiArticleRevisions,
  ({ one }) => ({
    article: one(wikiArticles, {
      fields: [wikiArticleRevisions.articleId],
      references: [wikiArticles.id],
    }),
  }),
);

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
