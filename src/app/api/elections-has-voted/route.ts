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
    // Get election info to find the number of seats (max votes)
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

    // Count how many votes the user has cast
    const voteCount = await query(
      "SELECT COUNT(*) as count FROM votes WHERE user_id = $1 AND election = $2",
      [userId, election]
    );

    // Get the list of candidate IDs the user has voted for
    const votedFor = await query(
      "SELECT candidate_id FROM votes WHERE user_id = $1 AND election = $2",
      [userId, election]
    );

    const votesUsed = Number(voteCount.rows[0]?.count || 0);
    const votedCandidateIds = votedFor.rows.map((row) => row.candidate_id);

    return NextResponse.json(
      {
        hasVoted: votesUsed > 0,
        votesUsed,
        maxVotes,
        votesRemaining: maxVotes - votesUsed,
        votedCandidateIds,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error checking vote status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
