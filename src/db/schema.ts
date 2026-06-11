import { integer, pgEnum, pgTable, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const voteEnum = pgEnum('vote', ['yes', 'no']);
export const billStageEnum = pgEnum('bill_stage', ['house', 'senate', 'president']);
export const billStatusEnum = pgEnum('bill_status', ['proposed', 'queued', 'voting', 'ratified', 'rejected']);

// Tables
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const accessTokens = pgTable('access_tokens', {
  id: serial('id').primaryKey(),
  token: text('token').notNull().unique(),
  createdBy: integer('created_by').notNull().references(() => accounts.id),
  redeemedBy: integer('redeemed_by').notNull().references(() => accounts.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const politicians = pgTable('politicians', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').notNull().references(() => accounts.id),
  nationId: integer('nation_id').notNull().references(() => nations.id),
});

export const nations = pgTable('nations', {
  id: serial('id').primaryKey(),
  // TODO: add other fields
});

export const stats = pgTable('stats', {
  id: serial('id').primaryKey(),
  // Add other global stats here
});

export const nation_stats = pgTable('nation_stats', {
  nationId: integer('nation_id').notNull().references(() => nations.id),
  statId: integer('stat_id').notNull().references(() => stats.id),
  value: integer('value').notNull().default(50),
}, (table) => [
  primaryKey({ name: 'nation_stats_pk', columns: [table.nationId, table.statId] }),
]);

export const policies = pgTable('policies', {
  id: serial('id').primaryKey(),
});

export const nation_policies = pgTable(
  'nation_policies',
  {
    nationId: integer('nation_id').notNull().references(() => nations.id),
    policyId: integer('policy_id').notNull().references(() => policies.id),
  },
  (table) => [
    primaryKey({ name: 'nation_policies_pk', columns: [table.nationId, table.policyId] }),
  ]
);


export const bills = pgTable('bills', {
  id: serial('id').primaryKey(),
  nationId: integer('nation_id').notNull().references(() => nations.id),
  status: billStatusEnum('status').notNull().default('queued'),
  stage: billStageEnum('stage').notNull().default('house'),
});

export const bill_clauses = pgTable('bill_clauses', {
  id: serial('id').primaryKey(),
  billId: integer('bill_id').notNull().references(() => bills.id),
});

export const ammendments = pgTable('ammendments', {
  id: serial('id').primaryKey(),
  billId: integer('bill_id').notNull().references(() => bills.id),
  billClauseId: integer('bill_clause_id').notNull().references(() => bill_clauses.id),
});

export const bill_votes_house = pgTable('bill_votes_house', {
  politicianId: integer('politician_id').notNull().references(() => politicians.id),
  billId: integer('bill_id').notNull().references(() => bills.id),
  vote: voteEnum('vote').notNull(),
}, (table) => [
  primaryKey({ name: 'bill_votes_house_pk', columns: [table.politicianId, table.billId] }),
]);

export const bill_votes_senate = pgTable('bill_votes_senate', {
  politicianId: integer('politician_id').notNull().references(() => politicians.id),
  billId: integer('bill_id').notNull().references(() => bills.id),
  vote: voteEnum('vote').notNull(),
}, (table) => [
  primaryKey({ name: 'bill_votes_senate_pk', columns: [table.politicianId, table.billId] }),
]);

export const bill_votes_president = pgTable('bill_votes_president', {
  politicianId: integer('politician_id').notNull().references(() => politicians.id),
  billId: integer('bill_id').notNull().references(() => bills.id),
  vote: voteEnum('vote').notNull(),
}, (table) => [
  primaryKey({ name: 'bill_votes_president_pk', columns: [table.politicianId, table.billId] }),
]);

export const proposal_supporters = pgTable('proposal_supporters', {
  accountId: integer('account_id').notNull().references(() => accounts.id),
  billId: integer('bill_id').notNull().references(() => bills.id),
}, (table) => [
  primaryKey({ name: 'proposal_supporters_pk', columns: [table.accountId, table.billId] }),
]);

// Relations
export const accountsRelations = relations(accounts, ({ many }) => ({
  politicians: many(politicians),
  accessTokens: many(accessTokens),
  proposalSupporters: many(proposal_supporters),
}));

export const accessTokensRelations = relations(accessTokens, ({ one }) => ({
  creator: one(accounts, {
    fields: [accessTokens.createdBy],
    references: [accounts.id],
    relationName: 'createdTokens',
  }),
  redeemer: one(accounts, {
    fields: [accessTokens.redeemedBy],
    references: [accounts.id],
    relationName: 'redeemedTokens',
  }),
}));

export const nationsRelations = relations(nations, ({ many }) => ({
  nationStats: many(nation_stats),
  politicians: many(politicians),
  bills: many(bills),
}));

export const politiciansRelations = relations(politicians, ({ one }) => ({
  account: one(accounts, {
    fields: [politicians.accountId],
    references: [accounts.id],
  }),
  nation: one(nations, {
    fields: [politicians.nationId],
    references: [nations.id],
  }),
}));

export const statsRelations = relations(stats, ({ many }) => ({
  nationStats: many(nation_stats),
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

export const billsRelations = relations(bills, ({ one, many }) => ({
  nation: one(nations, {
    fields: [bills.nationId],
    references: [nations.id],
  }),
  clauses: many(bill_clauses),
  ammendments: many(ammendments),
  supporters: many(proposal_supporters),
}));

export const billClausesRelations = relations(bill_clauses, ({ one, many }) => ({
  bill: one(bills, {
    fields: [bill_clauses.billId],
    references: [bills.id],
  }),
  ammendments: many(ammendments),
}));

export const ammendmentsRelations = relations(ammendments, ({ one }) => ({
  bill: one(bills, {
    fields: [ammendments.billId],
    references: [bills.id],
  }),
  clause: one(bill_clauses, {
    fields: [ammendments.billClauseId],
    references: [bill_clauses.id],
  }),
}));

export const proposalSupportersRelations = relations(proposal_supporters, ({ one }) => ({
  bill: one(bills, {
    fields: [proposal_supporters.billId],
    references: [bills.id],
  }),
  account: one(accounts, {
    fields: [proposal_supporters.accountId],
    references: [accounts.id],
  }),
}));
