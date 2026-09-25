CREATE TABLE "bill_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer NOT NULL REFERENCES "bills"("id") ON DELETE CASCADE,
	"user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
	"username" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bill_comments_bill_created_idx" ON "bill_comments" USING btree ("bill_id", "created_at");
