import { loadEnvFile } from "node:process";
import pg from "pg";

loadEnvFile();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL! });

const alterDDL = `
-- Missing columns from users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "moderation_role" varchar(20) DEFAULT 'player' NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_ancestry_root" boolean DEFAULT false NOT NULL;

-- Missing columns from parties table  
ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "former_leader_id" integer REFERENCES "users"("id") ON DELETE set null;

-- Missing columns from coalitions table
ALTER TABLE "coalitions" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;

-- Coalition members unique constraint already handled in 0028
`;

async function main() {
  await client.connect();
  try {
    await client.query(alterDDL);
    console.log("Missing columns added successfully");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});