import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { userId, partyId } = await request.json();
    if (!userId || !partyId) {
      return NextResponse.json(
        { error: "Missing userId or partyId" },
        { status: 400 }
      );
    }
    const result = await query(
      "SELECT * FROM users WHERE id = $1 AND party_id = $2",
      [userId, partyId]
    );
    return NextResponse.json(result.rows.length > 0);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to check membership" },
      { status: 500 }
    );
  }
}
