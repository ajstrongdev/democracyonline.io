import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

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
  nationId: integer('nation_id').primaryKey().references(() => nations.id),
  // Add other per-nation stats here
});

// Relations
export const accountsRelations = relations(accounts, ({ many }) => ({
  politicians: many(politicians),
  accessTokens: many(accessTokens),
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

export const nationsRelations = relations(nations, ({ one, many }) => ({
  stats: one(stats, {
    fields: [nations.id],
    references: [stats.nationId],
  }),
  politicians: many(politicians),
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

export const statsRelations = relations(stats, ({ one }) => ({
  nation: one(nations, {
    fields: [stats.nationId],
    references: [nations.id],
  }),
}));