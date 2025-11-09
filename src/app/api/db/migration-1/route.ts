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
