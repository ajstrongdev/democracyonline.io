import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId, candidateId, election } = await request.json();
  if (!userId || !candidateId || !election) {
    return NextResponse.json(
      { error: "userId, candidateId, and election are required" },
      { status: 400 }
    );
  }
  try {
    // Check if the user has already voted in this election
    const existingVote = await query(
      "SELECT * FROM votes WHERE user_id = $1 AND election = $2",
      [userId, election]
    );

    if (existingVote.rows.length > 0) {
      return NextResponse.json(
        { error: "User has already voted in this election" },
        { status: 400 }
      );
    }
    await query("INSERT INTO votes (user_id, election) VALUES ($1, $2)", [
      userId,
      election,
    ]);
    await query("UPDATE candidates SET votes = votes + 1 WHERE id = $1", [
      candidateId,
    ]);
    return NextResponse.json({ message: "Vote recorded successfully" });
  } catch (error) {
    console.error("Error recording vote:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
