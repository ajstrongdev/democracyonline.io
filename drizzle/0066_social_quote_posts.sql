ALTER TABLE "social_posts" ADD COLUMN "quoted_post_id" integer REFERENCES "social_posts"("id") ON DELETE set null;
CREATE INDEX "social_posts_quoted_idx" ON "social_posts" USING btree ("quoted_post_id");
