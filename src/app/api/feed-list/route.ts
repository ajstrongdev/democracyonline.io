import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const feedItems = await query(
      "SELECT * FROM feed ORDER BY created_at DESC LIMIT 50"
    );
    return NextResponse.json(feedItems.rows);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch feed items" },
      { status: 500 }
    );
  }
}
