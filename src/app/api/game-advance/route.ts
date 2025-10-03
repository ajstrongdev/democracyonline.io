import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
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
