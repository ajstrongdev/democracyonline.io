CREATE TABLE "social_dislikes" (
  "post_id" integer NOT NULL REFERENCES "social_posts"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "social_dislikes_post_user_pk" PRIMARY KEY ("post_id", "user_id")
);
CREATE INDEX "social_dislikes_user_idx" ON "social_dislikes" ("user_id");
CREATE TABLE "social_comment_dislikes" (
  "comment_id" integer NOT NULL REFERENCES "social_comments"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "social_comment_dislikes_comment_user_pk" PRIMARY KEY ("comment_id", "user_id")
);
CREATE INDEX "social_comment_dislikes_user_idx" ON "social_comment_dislikes" ("user_id");
