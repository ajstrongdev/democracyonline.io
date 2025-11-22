import { type NextRequest, NextResponse } from "next/server";
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
    // Add isActive column to users table
    await query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
    `);
    await query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_activity BIGINT DEFAULT 0
    `);
    return NextResponse.json(
      { success: true, message: "Migration 2 applied successfully" },
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
