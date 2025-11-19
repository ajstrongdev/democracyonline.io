import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest, response: NextResponse) {
  const { userId, partyId } = (await request.json()) as {
    userId: number;
    partyId: number;
  };
  try {
    const membershipCheck = await query(
      "SELECT * FROM users WHERE id = $1 AND party_id = $2",
      [userId, partyId]
    );
    if (membershipCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "User must be a member of the party to become leader" },
        { status: 403 }
      );
    }
    const result = await query(
      "UPDATE parties SET leader_id = $1 WHERE id = $2 RETURNING *",
      [userId, partyId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    } else {
      return NextResponse.json(result.rows[0]);
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to become party leader" },
      { status: 500 }
    );
  }
}
