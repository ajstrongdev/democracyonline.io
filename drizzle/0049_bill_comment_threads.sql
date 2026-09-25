ALTER TABLE "bill_comments" ADD COLUMN "parent_id" integer REFERENCES "bill_comments"("id") ON DELETE CASCADE;
CREATE INDEX "bill_comments_parent_idx" ON "bill_comments" ("parent_id");
