import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const billId = searchParams.get("billId");

    if (!billId) {
      return NextResponse.json(
        { error: "Bill ID is required" },
        { status: 400 }
      );
    }

    // Get House voters
    const houseVoters = await query(
      `SELECT u.id, u.username, u.party_id, p.name as party_name, p.color as party_color, bv.vote_yes
       FROM bill_votes_house bv
       JOIN users u ON bv.voter_id = u.id
       LEFT JOIN parties p ON u.party_id = p.id
       WHERE bv.bill_id = $1
       ORDER BY bv.vote_yes DESC, u.username ASC`,
      [billId]
    );

    // Get Senate voters
    const senateVoters = await query(
      `SELECT u.id, u.username, u.party_id, p.name as party_name, p.color as party_color, bv.vote_yes
       FROM bill_votes_senate bv
       JOIN users u ON bv.voter_id = u.id
       LEFT JOIN parties p ON u.party_id = p.id
       WHERE bv.bill_id = $1
       ORDER BY bv.vote_yes DESC, u.username ASC`,
      [billId]
    );

    // Get Presidential voters
    const presidentialVoters = await query(
      `SELECT u.id, u.username, u.party_id, p.name as party_name, p.color as party_color, bv.vote_yes
       FROM bill_votes_presidential bv
       JOIN users u ON bv.voter_id = u.id
       LEFT JOIN parties p ON u.party_id = p.id
       WHERE bv.bill_id = $1
       ORDER BY bv.vote_yes DESC, u.username ASC`,
      [billId]
    );

    return NextResponse.json({
      house: houseVoters.rows,
      senate: senateVoters.rows,
      presidential: presidentialVoters.rows,
    });
  } catch (error) {
    console.error("Error fetching bill voters:", error);
    return NextResponse.json(
      { error: "Failed to fetch bill voters" },
      { status: 500 }
    );
  }
}
