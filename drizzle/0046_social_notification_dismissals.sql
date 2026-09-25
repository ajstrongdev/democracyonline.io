CREATE TABLE "social_notification_dismissals" (
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "account_key" varchar(100) NOT NULL,
  "source_type" varchar(10) NOT NULL,
  "source_id" integer NOT NULL,
  "dismissed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "social_notification_dismissals_pk" PRIMARY KEY ("user_id", "account_key", "source_type", "source_id")
);
