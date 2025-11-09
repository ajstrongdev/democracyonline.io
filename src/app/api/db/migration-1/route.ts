import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    console.error("CRON_SECRET environment variable is not set");
    return NextResponse.json(
      { success: false, error: "Server configuration error" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Add new column to parties table for logo (lucide-react icon name)
    await query(
      `ALTER TABLE parties ADD COLUMN IF NOT EXISTS logo VARCHAR(100) DEFAULT NULL`
    );
    // Add game tracker table
    await query(`
      CREATE TABLE IF NOT EXISTS game_tracker (
      id SERIAL PRIMARY KEY,
      bill_pool INTEGER NOT NULL DEFAULT 1
      )`);
    await query(`INSERT INTO game_tracker (bill_pool) VALUES (1)`);

    // Alter bills table to add pool column
    await query(`
      ALTER TABLE bills ADD COLUMN IF NOT EXISTS pool INTEGER DEFAULT NULL
    `);

    // Give bills at vote a pool value
    await query(`
      UPDATE bills SET pool = 1 WHERE status = 'Voting'
    `);

    // Migration for Senate election voting system changes
    // Add candidate_id column to votes table if it doesn't exist
    await query(`
      ALTER TABLE votes ADD COLUMN IF NOT EXISTS candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE
    `);

    // Drop old unique constraint if it exists and add new one
    // First check and drop the old constraint
    await query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'votes_user_id_election_key'
        ) THEN
          ALTER TABLE votes DROP CONSTRAINT votes_user_id_election_key;
        END IF;
      END $$;
    `);

    // Add new unique constraint that includes candidate_id
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'votes_user_id_election_candidate_id_key'
        ) THEN
          ALTER TABLE votes ADD CONSTRAINT votes_user_id_election_candidate_id_key UNIQUE (user_id, election, candidate_id);
        END IF;
      END $$;
    `);

    // Ensure elections table has seats column
    await query(`
      ALTER TABLE elections ADD COLUMN IF NOT EXISTS seats INTEGER
    `);

    // Set default seats for existing elections
    await query(`
      UPDATE elections SET seats = 1 WHERE election = 'President' AND seats IS NULL
    `);

    await query(`
      UPDATE elections SET seats = 3 WHERE election = 'Senate' AND seats IS NULL
    `);

    return NextResponse.json(
      { success: true, message: "Migration 1 applied successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error applying migration 1:", error);
    return NextResponse.json(
      { success: false, error: "Failed to apply migration 1" },
      { status: 500 }
    );
  }
}
