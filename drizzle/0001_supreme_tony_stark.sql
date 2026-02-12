CREATE TABLE "candidate_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" bigint DEFAULT 0 NOT NULL,
	"purchased_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"target" varchar(50) NOT NULL,
	"increase_amount" bigint NOT NULL,
	"base_cost" bigint NOT NULL,
	"cost_multiplier" bigint DEFAULT 30 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_id" integer,
	"price" bigint NOT NULL,
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"price" bigint NOT NULL,
	"brought_today" bigint DEFAULT 0,
	"sold_today" bigint DEFAULT 0,
	CONSTRAINT "stocks_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "transaction_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "votes" RENAME COLUMN "election" TO "vote_type";--> statement-breakpoint
ALTER TABLE "votes" DROP CONSTRAINT "votes_user_id_election_candidate_id_unique";--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "votes_per_hour" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "donations_per_hour" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "donations" bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "party_subs" bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "parties" ADD COLUMN "money" bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "money" bigint DEFAULT 100;