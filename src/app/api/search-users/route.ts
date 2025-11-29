import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const searchQuery = searchParams.get("q");

  if (!searchQuery || searchQuery.trim() === "") {
    return NextResponse.json({ users: [] }, { status: 200 });
  }

  try {
    const result = await query(
      `SELECT id, username, bio, political_leaning, role, party_id, created_at, last_activity 
       FROM users 
       WHERE username ILIKE $1 
       AND username NOT LIKE 'Banned User%'
       ORDER BY username ASC
       LIMIT 50`,
      [`%${searchQuery}%`]
    );

    return NextResponse.json({ users: result.rows }, { status: 200 });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}
