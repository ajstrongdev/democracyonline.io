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
      UPDATE bills SET pool = 1 WHERE status = 'Voting' AND pool IS NULL
    `);

    // Merged party table
    await query(`
      CREATE TABLE IF NOT EXISTS merge_request (
      id SERIAL PRIMARY KEY,
      leader_id INT,
      name VARCHAR(255) NOT NULL,
      color VARCHAR(7) NOT NULL,
      bio TEXT,
      political_leaning VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      leaning VARCHAR(25) NOT NULL,
      logo VARCHAR(100) DEFAULT NULL
      )`);

    // PartyNotifications table for merge requests
    await query(`
      CREATE TABLE IF NOT EXISTS party_notifications (
      sender_party_id INTEGER NOT NULL,
      receiver_party_id INTEGER NOT NULL,
      merge_request_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      PRIMARY KEY (sender_party_id, receiver_party_id, merge_request_id),
      FOREIGN KEY (sender_party_id) REFERENCES parties(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_party_id) REFERENCES parties(id) ON DELETE CASCADE,
      FOREIGN KEY (merge_request_id) REFERENCES merge_request(id) ON DELETE CASCADE
      )`);

    // Merge request stances table
    await query(`
      CREATE TABLE IF NOT EXISTS merge_request_stances (
      id SERIAL PRIMARY KEY,
      merge_request_id INTEGER NOT NULL,
      stance_id INTEGER NOT NULL,
      value TEXT,
      FOREIGN KEY (merge_request_id) REFERENCES merge_request(id) ON DELETE CASCADE,
      FOREIGN KEY (stance_id) REFERENCES political_stances(id) ON DELETE CASCADE
      )`);

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
