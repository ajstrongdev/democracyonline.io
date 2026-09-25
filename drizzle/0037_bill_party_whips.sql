ALTER TABLE "bill_comments"
  ADD COLUMN "party_name" varchar(255),
  ADD COLUMN "is_party_leader" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "bill_party_whips" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer NOT NULL REFERENCES "bills"("id") ON DELETE CASCADE,
	"party_id" integer NOT NULL REFERENCES "parties"("id") ON DELETE CASCADE,
	"leader_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"position" varchar(10) NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bill_party_whips_bill_party_unique" UNIQUE("bill_id", "party_id")
);
--> statement-breakpoint
CREATE INDEX "bill_party_whips_bill_idx" ON "bill_party_whips" USING btree ("bill_id");
