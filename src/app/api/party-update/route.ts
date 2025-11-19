import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const {
    userId,
    partyId,
    name,
    color,
    bio,
    stanceValues,
    leaningValue,
    logo,
    discord,
  } = await request.json();
  try {
    const updateParty = await query(
      "UPDATE parties SET name = $1, color = $2, bio = $3, political_leaning = $4, logo = $5, discord = $6 WHERE id = $7 AND leader_id = $8 RETURNING *",
      [name, color, bio, leaningValue, logo, discord, partyId, userId]
    );

    /* eslint-disable @typescript-eslint/no-explicit-any */
    stanceValues.forEach(async (stance: any) => {
      await query(
        "UPDATE party_stances SET value = $1 WHERE party_id = $2 AND stance_id = $3",
        [stance.value, partyId, stance.id]
      );
    });

    return NextResponse.json(updateParty.rows[0]);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update party" },
      { status: 500 }
    );
  }
}
