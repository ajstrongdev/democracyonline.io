import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId, name, color, bio, manifestoUrl } = await request.json();
  try {
    const createParty = await query(
      "INSERT INTO parties (leader_id, name, color, bio, manifesto_url) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [userId, name, color, bio, manifestoUrl]
    );
    const partyId = createParty.rows[0].id;
    // Update user partyid
    await query("UPDATE users SET party_id = $1 WHERE id = $2", [
      partyId,
      userId,
    ]);
    return NextResponse.json(createParty.rows[0]);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create party" },
      { status: 500 }
    );
  }
}
