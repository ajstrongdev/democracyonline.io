import { type NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    console.error("CRON_SECRET environment variable is not set");
    return NextResponse.json(
      { success: false, error: "Server configuration error" },
      { status: 500 },
    );
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    // Create access_tokens table
    await query(`
      CREATE TABLE IF NOT EXISTS access_tokens (
        id SERIAL PRIMARY KEY,
        token VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    return NextResponse.json(
      { success: true, message: "Access tokens table created successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error creating access_tokens table:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create access_tokens table" },
      { status: 500 },
    );
  }
}
