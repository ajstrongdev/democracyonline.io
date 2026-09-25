CREATE TABLE IF NOT EXISTS "social_comment_likes" (
  "comment_id" integer NOT NULL REFERENCES "social_comments"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "social_comment_likes_comment_user_pk" PRIMARY KEY ("comment_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "social_comment_likes_user_idx" ON "social_comment_likes" ("user_id");
