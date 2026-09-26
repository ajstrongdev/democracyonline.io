CREATE TABLE IF NOT EXISTS "access_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"redeemed_at" timestamp,
	CONSTRAINT "access_tokens_token_unique" UNIQUE("token")
);

ALTER TABLE "access_tokens"
ADD COLUMN IF NOT EXISTS "redeemed_at" timestamp;
