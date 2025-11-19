import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId } = (await request.json()) as { userId: number };

  try {
    // 1) Find user's current party
    const userResult = await query("SELECT party_id FROM users WHERE id = $1", [
      userId,
    ]);
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const partyId: number | null = userResult.rows[0].party_id;

    // 2) If in a party, remove leadership if they are leader
    if (partyId) {
      await query(
        "UPDATE parties SET leader_id = NULL WHERE id = $1 AND leader_id = $2",
        [partyId, userId]
      );
    }

    // 3) Remove user from the party
    const result = await query(
      "UPDATE users SET party_id = NULL WHERE id = $1 RETURNING *",
      [userId]
    );

    // 4) If there was a party, check if it now has 0 members
    if (partyId) {
      const countRes = await query(
        "SELECT COUNT(*)::int AS cnt FROM users WHERE party_id = $1",
        [partyId]
      );
      const memberCount = countRes.rows[0]?.cnt ?? 0;

      if (memberCount === 0) {
        await query("DELETE FROM party_stances WHERE party_id = $1", [partyId]);
        await query("DELETE FROM parties WHERE id = $1", [partyId]);
      }
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to leave party:", error);
    return NextResponse.json(
      { error: "Failed to leave party" },
      { status: 500 }
    );
  }
}
