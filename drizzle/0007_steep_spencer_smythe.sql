CREATE TABLE IF NOT EXISTS "party_transaction_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"party_id" integer NOT NULL,
	"amount" bigint NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "merge_request" ADD COLUMN IF NOT EXISTS "party_subs" bigint DEFAULT 0;
