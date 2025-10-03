import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId, billId, role, vote } = await request.json();
  if (!userId || !billId || !role) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }
  let table = "";
  if (role === "Representative") {
    table = "bill_votes_house";
  } else if (role === "Senator") {
    table = "bill_votes_senate";
  } else if (role === "President") {
    table = "bill_votes_presidential";
  } else {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  try {
    const existingVote = await query(
      `SELECT * FROM ${table} WHERE voter_id = $1 AND bill_id = $2`,
      [userId, billId]
    );
    if (existingVote.rows.length > 0) {
      return NextResponse.json(
        { error: "User has already voted on this bill" },
        { status: 400 }
      );
    }
    const voteRes = await query(
      `INSERT INTO ${table} (voter_id, bill_id, vote_yes) VALUES ($1, $2, $3) RETURNING *`,
      [userId, billId, vote]
    );
    return NextResponse.json({ vote: voteRes.rows[0] }, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
