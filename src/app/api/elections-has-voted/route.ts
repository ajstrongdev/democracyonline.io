import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId, election } = await request.json();
  if (!userId || !election) {
    return NextResponse.json(
      { error: "userId and election are required" },
      { status: 400 }
    );
  }
  try {
    const existingVote = await query(
      "SELECT * FROM votes WHERE user_id = $1 AND election = $2",
      [userId, election]
    );

    if (existingVote.rows.length > 0) {
      return NextResponse.json({ hasVoted: true }, { status: 200 });
    } else {
      return NextResponse.json({ hasVoted: false }, { status: 200 });
    }
  } catch (error) {
    console.error("Error checking vote status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
