import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest, response: NextResponse) {
  const { userId, partyId } = (await request.json()) as {
    userId: number;
    partyId: number;
  };
  try {
    const result = await query(
      "UPDATE users SET party_id = $1 WHERE id = $2 RETURNING *",
      [partyId, userId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    } else {
      return NextResponse.json(result.rows[0]);
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to join party" },
      { status: 500 }
    );
  }
}
