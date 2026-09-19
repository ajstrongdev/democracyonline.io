CREATE TABLE "primary_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"party_id" integer NOT NULL,
	"coalition_id" integer,
	"votes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "primary_candidates_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "primary_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"candidate_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "primary_votes_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "candidate_purchases" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "candidate_snapshots" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "companies" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "donation_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_kpi_snapshots" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "game_state" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_fills" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "party_transaction_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "presidential_election" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "senate_election" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "share_issuance_events" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "share_price_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stock_orders" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stocks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transaction_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_shares" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "candidate_purchases" CASCADE;--> statement-breakpoint
DROP TABLE "candidate_snapshots" CASCADE;--> statement-breakpoint
DROP TABLE "companies" CASCADE;--> statement-breakpoint
DROP TABLE "donation_history" CASCADE;--> statement-breakpoint
DROP TABLE "finance_kpi_snapshots" CASCADE;--> statement-breakpoint
DROP TABLE "game_state" CASCADE;--> statement-breakpoint
DROP TABLE "items" CASCADE;--> statement-breakpoint
DROP TABLE "order_fills" CASCADE;--> statement-breakpoint
DROP TABLE "party_transaction_history" CASCADE;--> statement-breakpoint
DROP TABLE "presidential_election" CASCADE;--> statement-breakpoint
DROP TABLE "senate_election" CASCADE;--> statement-breakpoint
DROP TABLE "share_issuance_events" CASCADE;--> statement-breakpoint
DROP TABLE "share_price_history" CASCADE;--> statement-breakpoint
DROP TABLE "stock_orders" CASCADE;--> statement-breakpoint
DROP TABLE "stocks" CASCADE;--> statement-breakpoint
DROP TABLE "transaction_history" CASCADE;--> statement-breakpoint
DROP TABLE "user_shares" CASCADE;--> statement-breakpoint
DELETE FROM "votes";--> statement-breakpoint
DELETE FROM "candidates";--> statement-breakpoint
UPDATE "elections"
SET "status" = 'Candidate',
    "days_left" = CASE WHEN "election" = 'President' THEN 10 ELSE 4 END;--> statement-breakpoint
ALTER TABLE "votes" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "votes" ALTER COLUMN "candidate_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "rank" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "points" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "candidates" DROP COLUMN "votes_per_hour";--> statement-breakpoint
ALTER TABLE "candidates" DROP COLUMN "donations_per_hour";--> statement-breakpoint
ALTER TABLE "candidates" DROP COLUMN "donations";--> statement-breakpoint
ALTER TABLE "merge_request" DROP COLUMN "party_subs";--> statement-breakpoint
ALTER TABLE "parties" DROP COLUMN "party_subs";--> statement-breakpoint
ALTER TABLE "parties" DROP COLUMN "money";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "money";--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_vote_type_candidate_id_unique" UNIQUE("user_id","vote_type","candidate_id");--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_vote_type_rank_unique" UNIQUE("user_id","vote_type","rank");
