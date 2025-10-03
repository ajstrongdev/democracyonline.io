import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId, content } = await request.json();
  try {
    const createFeed = await query(
      "INSERT INTO feed (user_id, content) VALUES ($1, $2) RETURNING *",
      [userId, content]
    );
    return NextResponse.json(createFeed.rows[0]);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to add feed item" },
      { status: 500 }
    );
  }
}
