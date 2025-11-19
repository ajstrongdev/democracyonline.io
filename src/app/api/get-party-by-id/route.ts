import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const partyId = searchParams.get("partyId");

  if (!partyId) {
    return NextResponse.json(
      { error: "Missing partyId parameter" },
      { status: 400 }
    );
  }

  try {
    const partyRes = await query("SELECT * FROM parties WHERE id = $1", [partyId]);
    if (partyRes.rows.length === 0) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    const party = partyRes.rows[0];

    const stancesRes = await query(`
      SELECT ps.issue, pst.value, ps.id
      FROM party_stances pst
      JOIN political_stances ps ON pst.stance_id = ps.id
      WHERE pst.party_id = $1
      ORDER BY ps.id
    `, [partyId]);

    return NextResponse.json({
      ...party,
      stances: stancesRes.rows
    });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
