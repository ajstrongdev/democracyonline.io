import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { userId, billId, stage } = await request.json();

    if (!userId || !billId || !stage) {
      return NextResponse.json(
        { hasVoted: false, error: "Missing parameters" },
        { status: 400 }
      );
    }
    const res = await query(
      `SELECT * FROM bill_votes_${stage.toLowerCase()} WHERE voter_id = $1 AND bill_id = $2`,
      [userId, billId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ hasVoted: false }, { status: 200 });
    } else {
      return NextResponse.json({ hasVoted: true }, { status: 200 });
    }
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { hasVoted: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
