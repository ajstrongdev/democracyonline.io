import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import axios from "axios";

export async function POST(request: NextRequest) {
  const { userId, name, color, bio, stanceValues } = await request.json();
  try {
    const createParty = await query(
      "INSERT INTO parties (leader_id, name, color, bio) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, name, color, bio]
    );
    const partyId = createParty.rows[0].id;
    // Update user partyid
    await query("UPDATE users SET party_id = $1 WHERE id = $2", [
      partyId,
      userId,
    ]);

    stanceValues.forEach( async (stance: any) => {
      await query(
        "INSERT INTO party_stances (party_id, stance_id, value) VALUES ($1, $2, $3)",
        [partyId, stance.id, stance.value]
      )
    });

    return NextResponse.json(createParty.rows[0]);
  } catch (error) {
    console.log(error)
    return NextResponse.json(
      { error: "Failed to create party" },
      { status: 500 }
    );
  }
}
