-- Game state table (single-row, tracks global game counters)
CREATE TABLE IF NOT EXISTS "game_state" (
  "id" serial PRIMARY KEY NOT NULL,
  "current_game_hour" bigint DEFAULT 0 NOT NULL
);

-- Seed the initial row
INSERT INTO "game_state" ("id", "current_game_hour") VALUES (1, 0)
ON CONFLICT ("id") DO NOTHING;

-- Add game_hour column to stock_orders
ALTER TABLE "stock_orders" ADD COLUMN "game_hour" bigint DEFAULT 0 NOT NULL;
