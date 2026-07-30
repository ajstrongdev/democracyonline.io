import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Enums
export const voteEnum = pgEnum("vote", ["yes", "no"]);
export const billStageEnum = pgEnum("bill_stage", [
  "house",
  "senate",
  "president",
]);
export const billStatusEnum = pgEnum("bill_status", [
  "proposed",
  "queued",
  "voting",
  "ratified",
  "rejected",
]);
export const billStageOutcomeEnum = pgEnum("bill_stage_outcome", [
  "passed",
  "failed",
]);
export const amendmentStatusEnum = pgEnum("amendment_status", [
  "pending",
  "accepted",
  "rejected",
]);
export const articleStatusEnum = pgEnum("article_status", [
  "pending",
  "approved",
  "changes_requested",
  "denied",
]);
export const electionTypeEnum = pgEnum("election_type", [
  "presidential",
  "senate",
]);
export const resolutionTypeEnum = pgEnum("resolution_type", [
  "sanctions",
  "relief",
  "war",
  "peace",
]);
export const allianceRequestStatusEnum = pgEnum("alliance_request_status", [
  "pending",
  "accepted",
  "declined",
]);
export const telegramTypeEnum = pgEnum("telegram_type", ["dm", "alert"]);
export const telegramActionEnum = pgEnum("telegram_action", [
  "league_resolution_vote",
  "alliance_request_response",
]);
export const officeTypeEnum = pgEnum("office_type", [
  "president",
  "senator",
  "cabinet",
]);
export const nationEventTypeEnum = pgEnum("nation_event_type", [
  "election_held",
  "primary_held",
  "office_term_started",
  "office_term_ended",
  "bill_ratified",
  "bill_rejected",
  "policy_enacted",
  "party_founded",
  "party_dissolved",
  "party_merged",
  "coalition_formed",
  "coalition_dissolved",
  "war_declared",
  "war_ended",
  "alliance_formed",
  "alliance_broken",
  "league_resolution_passed",
]);

// Tables
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const access_tokens = pgTable("access_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => accounts.id),
  redeemedBy: integer("redeemed_by")
    .notNull()
    .references(() => accounts.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const politicians = pgTable("politicians", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id),
  nationId: integer("nation_id")
    .notNull()
    .references(() => nations.id),
  createdAt: timestamp("created_at").defaultNow(),
  retiredAt: timestamp("retired_at"),
  lastActiveAt: timestamp("last_active_at"),
});

export const nations = pgTable("nations", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow(),
  // TODO: add other fields
});

export const cabinet = pgTable("cabinet", {
  id: serial("id").primaryKey(),
  nationId: integer("nation_id")
    .notNull()
    .references(() => nations.id),
  politicianId: integer("politician_id")
    .notNull()
    .references(() => politicians.id),
  position: text("position").notNull(),
});

export const stats = pgTable("stats", {
  id: serial("id").primaryKey(),
  // Add other global stats here
});

export const nation_stats = pgTable(
  "nation_stats",
  {
    nationId: integer("nation_id")
      .notNull()
      .references(() => nations.id),
    statId: integer("stat_id")
      .notNull()
      .references(() => stats.id),
    value: integer("value").notNull().default(50),
  },
  (table) => [
    primaryKey({
      name: "nation_stats_pk",
      columns: [table.nationId, table.statId],
    }),
  ],
);

// Stat values over time, for graphs.
export const nation_stat_history = pgTable(
  "nation_stat_history",
  {
    id: serial("id").primaryKey(),
    nationId: integer("nation_id")
      .notNull()
      .references(() => nations.id),
    statId: integer("stat_id")
      .notNull()
      .references(() => stats.id),
    value: integer("value").notNull(),
    recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  },
  (table) => [
    index("nation_stat_history_series_idx").on(
      table.nationId,
      table.statId,
      table.recordedAt,
    ),
  ],
);

export const policies = pgTable("policies", {
  id: serial("id").primaryKey(),
});

export const nation_policies = pgTable(
  "nation_policies",
  {
    nationId: integer("nation_id")
      .notNull()
      .references(() => nations.id),
    policyId: integer("policy_id")
      .notNull()
      .references(() => policies.id),
  },
  (table) => [
    primaryKey({
      name: "nation_policies_pk",
      columns: [table.nationId, table.policyId],
    }),
  ],
);

export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  nationId: integer("nation_id")
    .notNull()
    .references(() => nations.id),
  status: billStatusEnum("status").notNull().default("queued"),
  stage: billStageEnum("stage").notNull().default("house"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bill_clauses = pgTable("bill_clauses", {
  id: serial("id").primaryKey(),
  billId: integer("bill_id")
    .notNull()
    .references(() => bills.id),
});

export const ammendments = pgTable("ammendments", {
  id: serial("id").primaryKey(),
  billId: integer("bill_id")
    .notNull()
    .references(() => bills.id),
  billClauseId: integer("bill_clause_id")
    .notNull()
    .references(() => bill_clauses.id),
  proposerId: integer("proposer_id").references(() => politicians.id),
  status: amendmentStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// Per-stage voting outcome for each bill.
export const bill_stage_history = pgTable("bill_stage_history", {
  id: serial("id").primaryKey(),
  billId: integer("bill_id")
    .notNull()
    .references(() => bills.id),
  stage: billStageEnum("stage").notNull(),
  outcome: billStageOutcomeEnum("outcome").notNull(),
  yesVotes: integer("yes_votes").notNull().default(0),
  noVotes: integer("no_votes").notNull().default(0),
  decidedAt: timestamp("decided_at").notNull().defaultNow(),
});

export const bill_votes_house = pgTable(
  "bill_votes_house",
  {
    politicianId: integer("politician_id")
      .notNull()
      .references(() => politicians.id),
    billId: integer("bill_id")
      .notNull()
      .references(() => bills.id),
    vote: voteEnum("vote").notNull(),
    votedAt: timestamp("voted_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "bill_votes_house_pk",
      columns: [table.politicianId, table.billId],
    }),
  ],
);

export const bill_votes_senate = pgTable(
  "bill_votes_senate",
  {
    politicianId: integer("politician_id")
      .notNull()
      .references(() => politicians.id),
    billId: integer("bill_id")
      .notNull()
      .references(() => bills.id),
    vote: voteEnum("vote").notNull(),
    votedAt: timestamp("voted_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "bill_votes_senate_pk",
      columns: [table.politicianId, table.billId],
    }),
  ],
);

export const bill_votes_president = pgTable(
  "bill_votes_president",
  {
    politicianId: integer("politician_id")
      .notNull()
      .references(() => politicians.id),
    billId: integer("bill_id")
      .notNull()
      .references(() => bills.id),
    vote: voteEnum("vote").notNull(),
    votedAt: timestamp("voted_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "bill_votes_president_pk",
      columns: [table.politicianId, table.billId],
    }),
  ],
);

export const proposal_supporters = pgTable(
  "proposal_supporters",
  {
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id),
    billId: integer("bill_id")
      .notNull()
      .references(() => bills.id),
  },
  (table) => [
    primaryKey({
      name: "proposal_supporters_pk",
      columns: [table.accountId, table.billId],
    }),
  ],
);

export const elections = pgTable("elections", {
  id: serial("id").primaryKey(),
  nationId: integer("nation_id")
    .notNull()
    .references(() => nations.id),
  electionType: text("election_type").notNull(),
  status: text("status").notNull(),
  // Cycle number, for ordering.
  term: integer("term"),
  winnerId: integer("winner_id").references(() => politicians.id),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const election_candidates = pgTable(
  "election_candidates",
  {
    electionId: integer("election_id")
      .notNull()
      .references(() => elections.id),
    politicianId: integer("politician_id")
      .notNull()
      .references(() => politicians.id),
    partyId: integer("party_id").references(() => parties.id),
    // Final tally, kept for history.
    voteCount: integer("vote_count").notNull().default(0),
    isWinner: boolean("is_winner").notNull().default(false),
  },
  (table) => [
    primaryKey({
      name: "election_candidates_pk",
      columns: [table.electionId, table.politicianId],
    }),
  ],
);

export const election_votes = pgTable(
  "election_votes",
  {
    electionId: integer("election_id")
      .notNull()
      .references(() => elections.id),
    politicianId: integer("politician_id")
      .notNull()
      .references(() => politicians.id),
  },
  (table) => [
    primaryKey({
      name: "election_votes_pk",
      columns: [table.electionId, table.politicianId],
    }),
  ],
);

export const parties = pgTable("parties", {
  id: serial("id").primaryKey(),
  nationId: integer("nation_id")
    .notNull()
    .references(() => nations.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  dissolvedAt: timestamp("dissolved_at"),
});

export const party_policies = pgTable(
  "party_policies",
  {
    partyId: integer("party_id")
      .notNull()
      .references(() => parties.id),
    policyId: integer("policy_id")
      .notNull()
      .references(() => policies.id),
    section: text("section"),
  },
  (table) => [
    primaryKey({
      name: "party_policies_pk",
      columns: [table.partyId, table.policyId],
    }),
  ],
);

export const party_newspapers = pgTable("party_newspapers", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id")
    .notNull()
    .references(() => parties.id),
  name: text("name").notNull(),
});

export const newspaper_issues = pgTable(
  "newspaper_issues",
  {
    id: serial("id").primaryKey(),
    newspaperId: integer("newspaper_id")
      .notNull()
      .references(() => party_newspapers.id),
    issueNumber: integer("issue_number").notNull(),
    title: text("title"),
    publishedAt: timestamp("published_at"),
  },
  (table) => [
    unique("newspaper_issues_number_unq").on(
      table.newspaperId,
      table.issueNumber,
    ),
  ],
);

export const newspaper_articles = pgTable("newspaper_articles", {
  id: serial("id").primaryKey(),
  newspaperId: integer("newspaper_id")
    .notNull()
    .references(() => party_newspapers.id),
  authorId: integer("author_id")
    .notNull()
    .references(() => accounts.id),
  issueId: integer("issue_id").references(() => newspaper_issues.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: articleStatusEnum("status").notNull().default("pending"),
  editorNote: text("editor_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coalitions = pgTable("coalitions", {
  id: serial("id").primaryKey(),
  nationId: integer("nation_id")
    .notNull()
    .references(() => nations.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  dissolvedAt: timestamp("dissolved_at"),
});

export const coalition_parties = pgTable(
  "coalition_parties",
  {
    coalitionId: integer("coalition_id")
      .notNull()
      .references(() => coalitions.id),
    partyId: integer("party_id")
      .notNull()
      .references(() => parties.id),
  },
  (table) => [
    primaryKey({
      name: "coalition_parties_pk",
      columns: [table.coalitionId, table.partyId],
    }),
  ],
);

export const party_merge_requests = pgTable(
  "party_merge_requests",
  {
    partyId: integer("party_id")
      .notNull()
      .references(() => parties.id),
    mergedPartyId: integer("merged_party_id")
      .notNull()
      .references(() => parties.id),
  },
  (table) => [
    primaryKey({
      name: "party_merge_requests_pk",
      columns: [table.partyId, table.mergedPartyId],
    }),
  ],
);

export const primaries = pgTable(
  "primaries",
  {
    id: serial("id").primaryKey(),
    nationId: integer("nation_id")
      .notNull()
      .references(() => nations.id),
    partyId: integer("party_id").references(() => parties.id),
    coalitionId: integer("coalition_id").references(() => coalitions.id),
    status: text("status").notNull(),
    term: integer("term"),
    winnerId: integer("winner_id").references(() => politicians.id),
    startedAt: timestamp("started_at").defaultNow(),
    endedAt: timestamp("ended_at"),
  },
  (table) => [
    check(
      "primaries_party_or_coalition",
      sql`num_nonnulls(${table.partyId}, ${table.coalitionId}) = 1`,
    ),
  ],
);

export const primary_candidates = pgTable(
  "primary_candidates",
  {
    primaryId: integer("primary_id")
      .notNull()
      .references(() => primaries.id),
    politicianId: integer("politician_id")
      .notNull()
      .references(() => politicians.id),
    voteCount: integer("vote_count").notNull().default(0),
    isWinner: boolean("is_winner").notNull().default(false),
  },
  (table) => [
    primaryKey({
      name: "primary_candidates_pk",
      columns: [table.primaryId, table.politicianId],
    }),
  ],
);

export const primary_votes = pgTable(
  "primary_votes",
  {
    primaryId: integer("primary_id")
      .notNull()
      .references(() => primaries.id),
    politicianId: integer("politician_id")
      .notNull()
      .references(() => politicians.id),
  },
  (table) => [
    primaryKey({
      name: "primary_votes_pk",
      columns: [table.primaryId, table.politicianId],
    }),
  ],
);

export const internationals = pgTable("internationals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const international_members = pgTable(
  "international_members",
  {
    internationalId: integer("international_id")
      .notNull()
      .references(() => internationals.id),
    partyId: integer("party_id")
      .notNull()
      .references(() => parties.id),
  },
  (table) => [
    primaryKey({
      name: "international_members_pk",
      columns: [table.internationalId, table.partyId],
    }),
  ],
);

export const league_resolutions = pgTable("league_resolutions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: resolutionTypeEnum("type").notNull(),
  nationId: integer("nation_id")
    .notNull()
    .references(() => nations.id),
  createdAt: timestamp("created_at").defaultNow(),
  targetNationId: integer("target_nation_id").references(() => nations.id),
});

export const league_resolution_votes = pgTable(
  "league_resolution_votes",
  {
    resolutionId: integer("resolution_id")
      .notNull()
      .references(() => league_resolutions.id),
    politicianId: integer("politician_id")
      .notNull()
      .references(() => politicians.id),
    nationId: integer("nation_id")
      .notNull()
      .references(() => nations.id),
    vote: voteEnum("vote").notNull(),
  },
  (table) => [
    primaryKey({
      name: "league_resolution_votes_pk",
      columns: [table.resolutionId, table.politicianId],
    }),
  ],
);

export const wars = pgTable("wars", {
  id: serial("id").primaryKey(),
  nationAId: integer("nation_a_id")
    .notNull()
    .references(() => nations.id),
  nationBId: integer("nation_b_id")
    .notNull()
    .references(() => nations.id),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const battles = pgTable("war_battles", {
  id: serial("id").primaryKey(),
  warId: integer("war_id")
    .notNull()
    .references(() => wars.id),
});

export const battle_participants = pgTable(
  "war_battle_participants",
  {
    battleId: integer("battle_id")
      .notNull()
      .references(() => battles.id),
    nationId: integer("nation_id")
      .notNull()
      .references(() => nations.id),
    supporting: integer("fighting_for") // If allied, this is the nation they are supporting
      .references(() => nations.id),
  },
  (table) => [
    primaryKey({
      name: "war_battle_participants_pk",
      columns: [table.battleId, table.nationId],
    }),
  ],
);

export const alliances = pgTable(
  "alliances",
  {
    id: serial("id").primaryKey(),
    nationAId: integer("nation_a_id")
      .notNull()
      .references(() => nations.id),
    nationBId: integer("nation_b_id")
      .notNull()
      .references(() => nations.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("alliances_pair_unq").on(table.nationAId, table.nationBId),
    check(
      "alliances_distinct_nations",
      sql`${table.nationAId} <> ${table.nationBId}`,
    ),
  ],
);

export const alliance_requests = pgTable(
  "alliance_requests",
  {
    id: serial("id").primaryKey(),
    requesterNationId: integer("requester_nation_id")
      .notNull()
      .references(() => nations.id),
    targetNationId: integer("target_nation_id")
      .notNull()
      .references(() => nations.id),
    status: allianceRequestStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    check(
      "alliance_requests_distinct_nations",
      sql`${table.requesterNationId} <> ${table.targetNationId}`,
    ),
  ],
);

export const telegrams = pgTable(
  "telegrams",
  {
    id: serial("id").primaryKey(),
    type: telegramTypeEnum("type").notNull(),
    // Null sender = system-generated.
    senderId: integer("sender_id").references(() => accounts.id),
    recipientId: integer("recipient_id")
      .notNull()
      .references(() => accounts.id),
    subject: text("subject"),
    body: text("body").notNull(),
    // Set when the telegram needs an action.
    actionType: telegramActionEnum("action_type"),
    leagueResolutionId: integer("league_resolution_id").references(
      () => league_resolutions.id,
    ),
    allianceRequestId: integer("alliance_request_id").references(
      () => alliance_requests.id,
    ),
    readAt: timestamp("read_at"),
    actionedAt: timestamp("actioned_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // DMs need a sender; alerts don't.
    check(
      "telegrams_dm_has_sender",
      sql`${table.type} <> 'dm' OR ${table.senderId} IS NOT NULL`,
    ),
  ],
);

// Past and present office holders.
export const office_terms = pgTable("office_terms", {
  id: serial("id").primaryKey(),
  nationId: integer("nation_id")
    .notNull()
    .references(() => nations.id),
  politicianId: integer("politician_id")
    .notNull()
    .references(() => politicians.id),
  office: officeTypeEnum("office").notNull(),
  // Cabinet role, e.g. Minister of Finance.
  position: text("position"),
  partyId: integer("party_id").references(() => parties.id),
  // Election that produced this term.
  electionId: integer("election_id").references(() => elections.id),
  term: integer("term"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

// Timeline feed for each nation's history wiki.
export const nation_events = pgTable("nation_events", {
  id: serial("id").primaryKey(),
  nationId: integer("nation_id")
    .notNull()
    .references(() => nations.id),
  type: nationEventTypeEnum("type").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  // Optional links to the source record.
  electionId: integer("election_id").references(() => elections.id),
  primaryId: integer("primary_id").references(() => primaries.id),
  billId: integer("bill_id").references(() => bills.id),
  warId: integer("war_id").references(() => wars.id),
  allianceId: integer("alliance_id").references(() => alliances.id),
  resolutionId: integer("resolution_id").references(
    () => league_resolutions.id,
  ),
  partyId: integer("party_id").references(() => parties.id),
  politicianId: integer("politician_id").references(() => politicians.id),
});

// Relations
export const accountsRelations = relations(accounts, ({ many }) => ({
  politicians: many(politicians),
  accessTokens: many(access_tokens),
  proposalSupporters: many(proposal_supporters),
  newspaperArticles: many(newspaper_articles),
  telegramsSent: many(telegrams, { relationName: "telegramsSent" }),
  telegramsReceived: many(telegrams, { relationName: "telegramsReceived" }),
}));

export const accessTokensRelations = relations(access_tokens, ({ one }) => ({
  creator: one(accounts, {
    fields: [access_tokens.createdBy],
    references: [accounts.id],
    relationName: "createdTokens",
  }),
  redeemer: one(accounts, {
    fields: [access_tokens.redeemedBy],
    references: [accounts.id],
    relationName: "redeemedTokens",
  }),
}));

export const nationsRelations = relations(nations, ({ many }) => ({
  nationStats: many(nation_stats),
  nationPolicies: many(nation_policies),
  politicians: many(politicians),
  bills: many(bills),
  elections: many(elections),
  parties: many(parties),
  coalitions: many(coalitions),
  primaries: many(primaries),
  leagueResolutions: many(league_resolutions, {
    relationName: "leagueResolutions",
  }),
  targetedResolutions: many(league_resolutions, {
    relationName: "targetedResolutions",
  }),
  leagueResolutionVotes: many(league_resolution_votes),
  warsAsA: many(wars, { relationName: "warsAsA" }),
  warsAsB: many(wars, { relationName: "warsAsB" }),
  battleParticipations: many(battle_participants, {
    relationName: "battleParticipations",
  }),
  battleSupporting: many(battle_participants, {
    relationName: "battleSupporting",
  }),
  alliancesAsA: many(alliances, { relationName: "alliancesAsA" }),
  alliancesAsB: many(alliances, { relationName: "alliancesAsB" }),
  allianceRequestsSent: many(alliance_requests, {
    relationName: "allianceRequestsSent",
  }),
  allianceRequestsReceived: many(alliance_requests, {
    relationName: "allianceRequestsReceived",
  }),
  cabinet: many(cabinet),
  officeTerms: many(office_terms),
  events: many(nation_events),
  statHistory: many(nation_stat_history),
}));

export const cabinetRelations = relations(cabinet, ({ one }) => ({
  nation: one(nations, {
    fields: [cabinet.nationId],
    references: [nations.id],
  }),
  politician: one(politicians, {
    fields: [cabinet.politicianId],
    references: [politicians.id],
  }),
}));

export const politiciansRelations = relations(politicians, ({ one, many }) => ({
  account: one(accounts, {
    fields: [politicians.accountId],
    references: [accounts.id],
  }),
  nation: one(nations, {
    fields: [politicians.nationId],
    references: [nations.id],
  }),
  billVotesHouse: many(bill_votes_house),
  billVotesSenate: many(bill_votes_senate),
  billVotesPresident: many(bill_votes_president),
  amendmentsProposed: many(ammendments),
  electionCandidates: many(election_candidates),
  electionVotes: many(election_votes),
  primaryCandidates: many(primary_candidates),
  primaryVotes: many(primary_votes),
  leagueResolutionVotes: many(league_resolution_votes),
  cabinetPositions: many(cabinet),
  officeTerms: many(office_terms),
  electionsWon: many(elections, { relationName: "electionWinner" }),
  primariesWon: many(primaries, { relationName: "primaryWinner" }),
}));

export const statsRelations = relations(stats, ({ many }) => ({
  nationStats: many(nation_stats),
  statHistory: many(nation_stat_history),
}));

export const nationStatsRelations = relations(nation_stats, ({ one }) => ({
  nation: one(nations, {
    fields: [nation_stats.nationId],
    references: [nations.id],
  }),
  stat: one(stats, {
    fields: [nation_stats.statId],
    references: [stats.id],
  }),
}));

export const nationStatHistoryRelations = relations(
  nation_stat_history,
  ({ one }) => ({
    nation: one(nations, {
      fields: [nation_stat_history.nationId],
      references: [nations.id],
    }),
    stat: one(stats, {
      fields: [nation_stat_history.statId],
      references: [stats.id],
    }),
  }),
);

export const billsRelations = relations(bills, ({ one, many }) => ({
  nation: one(nations, {
    fields: [bills.nationId],
    references: [nations.id],
  }),
  clauses: many(bill_clauses),
  ammendments: many(ammendments),
  supporters: many(proposal_supporters),
  votesHouse: many(bill_votes_house),
  votesSenate: many(bill_votes_senate),
  votesPresident: many(bill_votes_president),
  stageHistory: many(bill_stage_history),
}));

export const billClausesRelations = relations(
  bill_clauses,
  ({ one, many }) => ({
    bill: one(bills, {
      fields: [bill_clauses.billId],
      references: [bills.id],
    }),
    ammendments: many(ammendments),
  }),
);

export const ammendmentsRelations = relations(ammendments, ({ one }) => ({
  bill: one(bills, {
    fields: [ammendments.billId],
    references: [bills.id],
  }),
  clause: one(bill_clauses, {
    fields: [ammendments.billClauseId],
    references: [bill_clauses.id],
  }),
  proposer: one(politicians, {
    fields: [ammendments.proposerId],
    references: [politicians.id],
  }),
}));

export const billStageHistoryRelations = relations(
  bill_stage_history,
  ({ one }) => ({
    bill: one(bills, {
      fields: [bill_stage_history.billId],
      references: [bills.id],
    }),
  }),
);

export const proposalSupportersRelations = relations(
  proposal_supporters,
  ({ one }) => ({
    bill: one(bills, {
      fields: [proposal_supporters.billId],
      references: [bills.id],
    }),
    account: one(accounts, {
      fields: [proposal_supporters.accountId],
      references: [accounts.id],
    }),
  }),
);

export const policiesRelations = relations(policies, ({ many }) => ({
  nationPolicies: many(nation_policies),
  partyPolicies: many(party_policies),
}));

export const nationPoliciesRelations = relations(
  nation_policies,
  ({ one }) => ({
    nation: one(nations, {
      fields: [nation_policies.nationId],
      references: [nations.id],
    }),
    policy: one(policies, {
      fields: [nation_policies.policyId],
      references: [policies.id],
    }),
  }),
);

export const billVotesHouseRelations = relations(
  bill_votes_house,
  ({ one }) => ({
    politician: one(politicians, {
      fields: [bill_votes_house.politicianId],
      references: [politicians.id],
    }),
    bill: one(bills, {
      fields: [bill_votes_house.billId],
      references: [bills.id],
    }),
  }),
);

export const billVotesSenateRelations = relations(
  bill_votes_senate,
  ({ one }) => ({
    politician: one(politicians, {
      fields: [bill_votes_senate.politicianId],
      references: [politicians.id],
    }),
    bill: one(bills, {
      fields: [bill_votes_senate.billId],
      references: [bills.id],
    }),
  }),
);

export const billVotesPresidentRelations = relations(
  bill_votes_president,
  ({ one }) => ({
    politician: one(politicians, {
      fields: [bill_votes_president.politicianId],
      references: [politicians.id],
    }),
    bill: one(bills, {
      fields: [bill_votes_president.billId],
      references: [bills.id],
    }),
  }),
);

export const electionsRelations = relations(elections, ({ one, many }) => ({
  nation: one(nations, {
    fields: [elections.nationId],
    references: [nations.id],
  }),
  winner: one(politicians, {
    fields: [elections.winnerId],
    references: [politicians.id],
    relationName: "electionWinner",
  }),
  candidates: many(election_candidates),
  votes: many(election_votes),
  officeTerms: many(office_terms),
}));

export const electionCandidatesRelations = relations(
  election_candidates,
  ({ one }) => ({
    election: one(elections, {
      fields: [election_candidates.electionId],
      references: [elections.id],
    }),
    politician: one(politicians, {
      fields: [election_candidates.politicianId],
      references: [politicians.id],
    }),
    party: one(parties, {
      fields: [election_candidates.partyId],
      references: [parties.id],
    }),
  }),
);

export const electionVotesRelations = relations(election_votes, ({ one }) => ({
  election: one(elections, {
    fields: [election_votes.electionId],
    references: [elections.id],
  }),
  politician: one(politicians, {
    fields: [election_votes.politicianId],
    references: [politicians.id],
  }),
}));

export const partiesRelations = relations(parties, ({ one, many }) => ({
  nation: one(nations, {
    fields: [parties.nationId],
    references: [nations.id],
  }),
  partyPolicies: many(party_policies),
  coalitionParties: many(coalition_parties),
  mergeRequestsSent: many(party_merge_requests, {
    relationName: "mergeRequestsSent",
  }),
  mergeRequestsReceived: many(party_merge_requests, {
    relationName: "mergeRequestsReceived",
  }),
  primaries: many(primaries),
  newspapers: many(party_newspapers),
  internationalMembers: many(international_members),
  electionCandidates: many(election_candidates),
  officeTerms: many(office_terms),
  events: many(nation_events),
}));

export const partyNewspapersRelations = relations(
  party_newspapers,
  ({ one, many }) => ({
    party: one(parties, {
      fields: [party_newspapers.partyId],
      references: [parties.id],
    }),
    issues: many(newspaper_issues),
    articles: many(newspaper_articles),
  }),
);

export const newspaperIssuesRelations = relations(
  newspaper_issues,
  ({ one, many }) => ({
    newspaper: one(party_newspapers, {
      fields: [newspaper_issues.newspaperId],
      references: [party_newspapers.id],
    }),
    articles: many(newspaper_articles),
  }),
);

export const newspaperArticlesRelations = relations(
  newspaper_articles,
  ({ one }) => ({
    newspaper: one(party_newspapers, {
      fields: [newspaper_articles.newspaperId],
      references: [party_newspapers.id],
    }),
    issue: one(newspaper_issues, {
      fields: [newspaper_articles.issueId],
      references: [newspaper_issues.id],
    }),
    author: one(accounts, {
      fields: [newspaper_articles.authorId],
      references: [accounts.id],
    }),
  }),
);

export const partyPoliciesRelations = relations(party_policies, ({ one }) => ({
  party: one(parties, {
    fields: [party_policies.partyId],
    references: [parties.id],
  }),
  policy: one(policies, {
    fields: [party_policies.policyId],
    references: [policies.id],
  }),
}));

export const coalitionsRelations = relations(coalitions, ({ one, many }) => ({
  nation: one(nations, {
    fields: [coalitions.nationId],
    references: [nations.id],
  }),
  coalitionParties: many(coalition_parties),
  primaries: many(primaries),
}));

export const coalitionPartiesRelations = relations(
  coalition_parties,
  ({ one }) => ({
    coalition: one(coalitions, {
      fields: [coalition_parties.coalitionId],
      references: [coalitions.id],
    }),
    party: one(parties, {
      fields: [coalition_parties.partyId],
      references: [parties.id],
    }),
  }),
);

export const partyMergeRequestsRelations = relations(
  party_merge_requests,
  ({ one }) => ({
    party: one(parties, {
      fields: [party_merge_requests.partyId],
      references: [parties.id],
      relationName: "mergeRequestsSent",
    }),
    mergedParty: one(parties, {
      fields: [party_merge_requests.mergedPartyId],
      references: [parties.id],
      relationName: "mergeRequestsReceived",
    }),
  }),
);

export const primariesRelations = relations(primaries, ({ one, many }) => ({
  nation: one(nations, {
    fields: [primaries.nationId],
    references: [nations.id],
  }),
  party: one(parties, {
    fields: [primaries.partyId],
    references: [parties.id],
  }),
  coalition: one(coalitions, {
    fields: [primaries.coalitionId],
    references: [coalitions.id],
  }),
  winner: one(politicians, {
    fields: [primaries.winnerId],
    references: [politicians.id],
    relationName: "primaryWinner",
  }),
  candidates: many(primary_candidates),
  votes: many(primary_votes),
}));

export const primaryCandidatesRelations = relations(
  primary_candidates,
  ({ one }) => ({
    primary: one(primaries, {
      fields: [primary_candidates.primaryId],
      references: [primaries.id],
    }),
    politician: one(politicians, {
      fields: [primary_candidates.politicianId],
      references: [politicians.id],
    }),
  }),
);

export const primaryVotesRelations = relations(primary_votes, ({ one }) => ({
  primary: one(primaries, {
    fields: [primary_votes.primaryId],
    references: [primaries.id],
  }),
  politician: one(politicians, {
    fields: [primary_votes.politicianId],
    references: [politicians.id],
  }),
}));

export const internationalsRelations = relations(
  internationals,
  ({ many }) => ({
    members: many(international_members),
  }),
);

export const internationalMembersRelations = relations(
  international_members,
  ({ one }) => ({
    international: one(internationals, {
      fields: [international_members.internationalId],
      references: [internationals.id],
    }),
    party: one(parties, {
      fields: [international_members.partyId],
      references: [parties.id],
    }),
  }),
);

export const leagueResolutionsRelations = relations(
  league_resolutions,
  ({ one, many }) => ({
    nation: one(nations, {
      fields: [league_resolutions.nationId],
      references: [nations.id],
      relationName: "leagueResolutions",
    }),
    targetNation: one(nations, {
      fields: [league_resolutions.targetNationId],
      references: [nations.id],
      relationName: "targetedResolutions",
    }),
    votes: many(league_resolution_votes),
    telegrams: many(telegrams),
  }),
);

export const leagueResolutionVotesRelations = relations(
  league_resolution_votes,
  ({ one }) => ({
    resolution: one(league_resolutions, {
      fields: [league_resolution_votes.resolutionId],
      references: [league_resolutions.id],
    }),
    politician: one(politicians, {
      fields: [league_resolution_votes.politicianId],
      references: [politicians.id],
    }),
    nation: one(nations, {
      fields: [league_resolution_votes.nationId],
      references: [nations.id],
    }),
  }),
);

export const warsRelations = relations(wars, ({ one, many }) => ({
  nationA: one(nations, {
    fields: [wars.nationAId],
    references: [nations.id],
    relationName: "warsAsA",
  }),
  nationB: one(nations, {
    fields: [wars.nationBId],
    references: [nations.id],
    relationName: "warsAsB",
  }),
  battles: many(battles),
}));

export const battlesRelations = relations(battles, ({ one, many }) => ({
  war: one(wars, {
    fields: [battles.warId],
    references: [wars.id],
  }),
  participants: many(battle_participants),
}));

export const battleParticipantsRelations = relations(
  battle_participants,
  ({ one }) => ({
    battle: one(battles, {
      fields: [battle_participants.battleId],
      references: [battles.id],
    }),
    nation: one(nations, {
      fields: [battle_participants.nationId],
      references: [nations.id],
      relationName: "battleParticipations",
    }),
    supportingNation: one(nations, {
      fields: [battle_participants.supporting],
      references: [nations.id],
      relationName: "battleSupporting",
    }),
  }),
);

export const alliancesRelations = relations(alliances, ({ one }) => ({
  nationA: one(nations, {
    fields: [alliances.nationAId],
    references: [nations.id],
    relationName: "alliancesAsA",
  }),
  nationB: one(nations, {
    fields: [alliances.nationBId],
    references: [nations.id],
    relationName: "alliancesAsB",
  }),
}));

export const allianceRequestsRelations = relations(
  alliance_requests,
  ({ one, many }) => ({
    requester: one(nations, {
      fields: [alliance_requests.requesterNationId],
      references: [nations.id],
      relationName: "allianceRequestsSent",
    }),
    target: one(nations, {
      fields: [alliance_requests.targetNationId],
      references: [nations.id],
      relationName: "allianceRequestsReceived",
    }),
    telegrams: many(telegrams),
  }),
);

export const telegramsRelations = relations(telegrams, ({ one }) => ({
  sender: one(accounts, {
    fields: [telegrams.senderId],
    references: [accounts.id],
    relationName: "telegramsSent",
  }),
  recipient: one(accounts, {
    fields: [telegrams.recipientId],
    references: [accounts.id],
    relationName: "telegramsReceived",
  }),
  leagueResolution: one(league_resolutions, {
    fields: [telegrams.leagueResolutionId],
    references: [league_resolutions.id],
  }),
  allianceRequest: one(alliance_requests, {
    fields: [telegrams.allianceRequestId],
    references: [alliance_requests.id],
  }),
}));

export const officeTermsRelations = relations(office_terms, ({ one }) => ({
  nation: one(nations, {
    fields: [office_terms.nationId],
    references: [nations.id],
  }),
  politician: one(politicians, {
    fields: [office_terms.politicianId],
    references: [politicians.id],
  }),
  party: one(parties, {
    fields: [office_terms.partyId],
    references: [parties.id],
  }),
  election: one(elections, {
    fields: [office_terms.electionId],
    references: [elections.id],
  }),
}));

export const nationEventsRelations = relations(nation_events, ({ one }) => ({
  nation: one(nations, {
    fields: [nation_events.nationId],
    references: [nations.id],
  }),
  election: one(elections, {
    fields: [nation_events.electionId],
    references: [elections.id],
  }),
  primary: one(primaries, {
    fields: [nation_events.primaryId],
    references: [primaries.id],
  }),
  bill: one(bills, {
    fields: [nation_events.billId],
    references: [bills.id],
  }),
  war: one(wars, {
    fields: [nation_events.warId],
    references: [wars.id],
  }),
  alliance: one(alliances, {
    fields: [nation_events.allianceId],
    references: [alliances.id],
  }),
  resolution: one(league_resolutions, {
    fields: [nation_events.resolutionId],
    references: [league_resolutions.id],
  }),
  party: one(parties, {
    fields: [nation_events.partyId],
    references: [parties.id],
  }),
  politician: one(politicians, {
    fields: [nation_events.politicianId],
    references: [politicians.id],
  }),
}));
