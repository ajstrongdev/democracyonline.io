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
    // Get election info to find the number of seats (vote limit)
    const electionInfo = await query(
      "SELECT seats FROM elections WHERE election = $1",
      [election]
    );

    if (electionInfo.rows.length === 0) {
      return NextResponse.json(
        { error: "Election not found" },
        { status: 404 }
      );
    }

    const maxVotes = electionInfo.rows[0].seats;

    // Check how many votes the user has already cast in this election
    const existingVotes = await query(
      "SELECT COUNT(*) as count FROM votes WHERE user_id = $1 AND election = $2",
      [userId, election]
    );

    const voteCount = Number(existingVotes.rows[0]?.count || 0);

    if (voteCount >= maxVotes) {
      return NextResponse.json(
        {
          error: `You have already cast all ${maxVotes} votes for this election`,
        },
        { status: 400 }
      );
    }

    // Check if user has already voted for this specific candidate
    const duplicateVote = await query(
      "SELECT * FROM votes WHERE user_id = $1 AND election = $2 AND candidate_id = $3",
      [userId, election, candidateId]
    );

    if (duplicateVote.rows.length > 0) {
      return NextResponse.json(
        { error: "You have already voted for this candidate" },
        { status: 400 }
      );
    }

    // Record the vote
    await query(
      "INSERT INTO votes (user_id, election, candidate_id) VALUES ($1, $2, $3)",
      [userId, election, candidateId]
    );

    // Increment candidate vote count
    await query("UPDATE candidates SET votes = votes + 1 WHERE id = $1", [
      candidateId,
    ]);

    return NextResponse.json({
      message: "Vote recorded successfully",
      votesRemaining: maxVotes - voteCount - 1,
    });
  } catch (error) {
    console.error("Error recording vote:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
