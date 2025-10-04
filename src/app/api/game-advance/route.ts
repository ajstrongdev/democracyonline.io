import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  // Presidential elections
  try {
    const res = await query(
      // Get "status" of presidential election
      "SELECT * FROM elections WHERE election = 'President'"
    );
    const electionStatus = res.rows[0]?.status;
    console.log("Election Status:", electionStatus);
    const daysLeft = res.rows[0]?.days_left;
    console.log("Days Left:", daysLeft);
    if (electionStatus === "Candidate") {
      if (daysLeft > 1) {
        // Decrement days left
        await query(
          "UPDATE elections SET days_left = days_left - 1 WHERE election = 'President'"
        );
      } else {
        // Transition to "Voting" phase and set days_left to 5 for voting period
        await query(
          "UPDATE elections SET status = 'Voting', days_left = 5 WHERE election = 'President'"
        );
      }
    } else if (electionStatus === "Voting") {
      if (daysLeft > 1) {
        // Decrement days left
        await query(
          "UPDATE elections SET days_left = days_left - 1 WHERE election = 'President'"
        );
      } else {
        // Remove all users with role "President" before electing new one
        await query(
          "UPDATE users SET role = 'Representative' WHERE role = 'President'"
        );
        // Election ends, determine winner
        const candidatesRes = await query(
          "SELECT * FROM candidates WHERE election = 'President' ORDER BY votes DESC LIMIT 1"
        );
        let winner = candidatesRes.rows[0];
        // Check for ties
        const topVotes = winner?.votes;
        const tiedCandidates = candidatesRes.rows.filter(
          (c) => c.votes === topVotes
        );

        if (tiedCandidates.length > 1) {
          // Tie detected - randomly select winner
          const randomIndex = Math.floor(Math.random() * tiedCandidates.length);
          winner = tiedCandidates[randomIndex];
        }
        if (winner) {
          // Update the role of the winning user to "President"
          await query("UPDATE users SET role = 'President' WHERE id = $1", [
            winner.user_id,
          ]);
          // Move to "Concluded" status
          await query(
            "UPDATE elections SET status = 'Concluded', days_left = 4 WHERE election = 'President'"
          );
        }
      }
    } else if (electionStatus === "Concluded") {
      if (daysLeft > 1) {
        // Decrement days left
        await query(
          "UPDATE elections SET days_left = days_left - 1 WHERE election = 'President'"
        );
      } else {
        // Reset election to "Candidate" phase for next cycle
        await query("DELETE FROM candidates WHERE election = 'President'");
        await query("DELETE FROM votes WHERE election = 'President'");
        await query(
          "UPDATE elections SET status = 'Candidate', days_left = 5 WHERE election = 'President'"
        );
      }
    }
  } catch (error) {
    console.error("Error handling presidential election status:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
  // Legislative process
  try {
    const res = await query(
      "SELECT * FROM bills WHERE stage = 'Presidential' AND status = 'Voting'"
    );
    // Count votes
    if (res.rows.length !== 0) {
      const bill = res.rows[0];
      const votesRes = await query(
        "SELECT vote_yes, COUNT(*) as count FROM bill_votes_presidential WHERE bill_id = $1 GROUP BY vote_yes",
        [bill.id]
      );
      const yesVotes =
        votesRes.rows.find((row) => row.vote_yes === true)?.count || 0;
      const noVotes =
        votesRes.rows.find((row) => row.vote_yes === false)?.count || 0;
      if (yesVotes > noVotes) {
        // Bill passes
        await query("UPDATE bills SET status = 'Passed' WHERE id = $1", [
          bill.id,
        ]);
      } else {
        // Bill fails
        await query("UPDATE bills SET status = 'Defeated' WHERE id = $1", [
          bill.id,
        ]);
      }
    }
  } catch (error) {
    console.error("Error fetching presidential bill:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
  try {
    // Check if the senate has a current bill in progress
    const res = await query(
      "SELECT * FROM bills WHERE stage = 'Senate' AND status = 'Voting'"
    );
    if (res.rows.length !== 0) {
      // Count votes
      const bill = res.rows[0];
      const votesRes = await query(
        "SELECT vote_yes, COUNT(*) as count FROM bill_votes_senate WHERE bill_id = $1 GROUP BY vote_yes",
        [bill.id]
      );
      const yesVotes =
        votesRes.rows.find((row) => row.vote_yes === true)?.count || 0;
      const noVotes =
        votesRes.rows.find((row) => row.vote_yes === false)?.count || 0;
      if (yesVotes > noVotes) {
        // Bill passes
        await query(
          "UPDATE bills SET stage = 'Presidential', status = 'Voting' WHERE id = $1",
          [bill.id]
        );
      } else {
        // Bill fails
        await query("UPDATE bills SET status = 'Defeated' WHERE id = $1", [
          bill.id,
        ]);
      }
    }
  } catch (error) {
    console.error("Error in the senate:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
  // Check if the house has a current bill in progress
  try {
    const res = await query(
      "SELECT * FROM bills WHERE stage = 'House' AND status = 'Voting'"
    );
    if (res.rows.length !== 0) {
      // Count votes
      const bill = res.rows[0];
      const votesRes = await query(
        "SELECT vote_yes, COUNT(*) as count FROM bill_votes_house WHERE bill_id = $1 GROUP BY vote_yes",
        [bill.id]
      );
      const yesVotes =
        votesRes.rows.find((row) => row.vote_yes === true)?.count || 0;
      const noVotes =
        votesRes.rows.find((row) => row.vote_yes === false)?.count || 0;
      if (yesVotes > noVotes) {
        // Bill passes to Senate
        await query(
          "UPDATE bills SET stage = 'Senate', status = 'Voting' WHERE id = $1",
          [bill.id]
        );
      } else {
        // Bill fails
        await query("UPDATE bills SET status = 'Defeated' WHERE id = $1", [
          bill.id,
        ]);
      }
    }
    // Get the next bill in the queue (if any)
    const nextBillRes = await query(
      "SELECT * FROM bills WHERE stage = 'House' AND status = 'Queued' ORDER BY created_at ASC LIMIT 1"
    );
    if (nextBillRes.rows.length > 0) {
      const nextBill = nextBillRes.rows[0];
      await query("UPDATE bills SET status = 'Voting' WHERE id = $1", [
        nextBill.id,
      ]);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error advancing bill:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
