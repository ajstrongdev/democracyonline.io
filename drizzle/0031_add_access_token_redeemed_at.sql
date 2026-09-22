ALTER TABLE "access_tokens"
ADD COLUMN IF NOT EXISTS "redeemed_at" timestamp;
