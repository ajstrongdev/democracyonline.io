import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { billId, stage } = await request.json();
    if (!billId) {
      return NextResponse.json(
        { error: "Missing billId parameter" },
        { status: 400 }
      );
    }
    const billRes = await query(
      "SELECT id FROM bills WHERE id = $1 AND status = 'Voting' AND stage = $2",
      [billId, stage]
    );
    if (!billRes.rows || billRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Bill not found or not in Voting/House stage" },
        { status: 404 }
      );
    }
    // Count votes
    const voteRes = await query(
      `SELECT 
                COUNT(*) FILTER (WHERE vote_yes = true) AS true_count,
                COUNT(*) FILTER (WHERE vote_yes = false) AS false_count
             FROM bill_votes_${stage.toLowerCase()} WHERE bill_id = $1`,
      [billId]
    );
    return NextResponse.json(
      {
        for: parseInt(voteRes.rows[0].true_count, 10),
        against: parseInt(voteRes.rows[0].false_count, 10),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
