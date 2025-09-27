import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId } = (await request.json()) as { userId: number };
  try {
    const userResult = await query("SELECT party_id FROM users WHERE id = $1", [
      userId,
    ]);
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const partyId = userResult.rows[0].party_id;
    // Remove leadership if leader
    if (partyId) {
      await query(
        "UPDATE parties SET leader_id = NULL WHERE id = $1 AND leader_id = $2",
        [partyId, userId]
      );
    }
    const result = await query(
      "UPDATE users SET party_id = NULL WHERE id = $1 RETURNING *",
      [userId]
    );
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to leave party" },
      { status: 500 }
    );
  }
}
