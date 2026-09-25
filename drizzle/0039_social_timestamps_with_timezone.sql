ALTER TABLE "social_posts"
  ALTER COLUMN "created_at" TYPE timestamptz
  USING "created_at" AT TIME ZONE current_setting('TIMEZONE');
--> statement-breakpoint
ALTER TABLE "social_comments"
  ALTER COLUMN "created_at" TYPE timestamptz
  USING "created_at" AT TIME ZONE current_setting('TIMEZONE');
--> statement-breakpoint
ALTER TABLE "social_likes"
  ALTER COLUMN "created_at" TYPE timestamptz
  USING "created_at" AT TIME ZONE current_setting('TIMEZONE');
--> statement-breakpoint
ALTER TABLE "social_reposts"
  ALTER COLUMN "created_at" TYPE timestamptz
  USING "created_at" AT TIME ZONE current_setting('TIMEZONE');
