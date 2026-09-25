ALTER TABLE "social_posts"
  ADD COLUMN "account_party_id" integer REFERENCES "parties"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "social_posts_party_created_idx"
  ON "social_posts" USING btree ("account_party_id", "created_at" DESC);
