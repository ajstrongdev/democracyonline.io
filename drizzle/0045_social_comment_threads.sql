ALTER TABLE "social_comments" ADD COLUMN "parent_id" integer REFERENCES "social_comments"("id") ON DELETE CASCADE;
CREATE INDEX "social_comments_parent_idx" ON "social_comments" ("parent_id");
