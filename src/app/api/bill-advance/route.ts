import { OAuth2Client } from "google-auth-library";
import { type NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

const oAuth2Client = new OAuth2Client();

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error("Missing or invalid Authorization header");
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  const token = authHeader.substring(7); // Remove "Bearer " prefix
  try {
    const ticket = await oAuth2Client.verifyIdToken({
      idToken: token,
      audience:
        process.env.NEXT_PUBLIC_SITE_URL || "https://democracyonline.io",
    });
    const payload = ticket.getPayload();
    // Verify it's from the scheduler service account
    // The email should be: <app-name>-scheduler@<project-id>.iam.gserviceaccount.com
    const expectedEmailPattern = /-scheduler@.*\.iam\.gserviceaccount\.com$/;
    if (!payload?.email || !expectedEmailPattern.test(payload.email)) {
      console.error("Invalid service account:", payload?.email);
      return NextResponse.json(
        { success: false, error: "Unauthorized - Invalid service account" },
        { status: 401 },
      );
    }
    console.log("Authenticated request from:", payload.email);
  } catch (error) {
    console.error("Token validation failed:", error);
    return NextResponse.json(
      { success: false, error: "Unauthorized - Invalid token" },
      { status: 401 },
    );
  }
  try {
    // Get current bill_pool from game_tracker
    const poolResult = await query(`SELECT bill_pool FROM game_tracker`);
    const currentPool =
      poolResult.rows.length > 0
        ? parseInt(poolResult.rows[0].bill_pool, 10)
        : 1;

    // Calculate the next pool (wrap from 3 to 1)
    const nextPool = currentPool === 3 ? 1 : currentPool + 1;

    // Presidential stage: Only advance bills that have pool = currentPool (completed 24 hours)
    try {
      const res = await query(
        "SELECT * FROM bills WHERE stage = 'Presidential' AND status = 'Voting' AND pool = $1",
        [currentPool],
      );

      for (const bill of res.rows) {
        const votesRes = await query(
          "SELECT vote_yes, COUNT(*) as count FROM bill_votes_presidential WHERE bill_id = $1 GROUP BY vote_yes",
          [bill.id],
        );
        const yesVotes = Number(
          votesRes.rows.find((row) => row.vote_yes === true)?.count || 0,
        );
        const noVotes = Number(
          votesRes.rows.find((row) => row.vote_yes === false)?.count || 0,
        );

        if (yesVotes > noVotes) {
          await query("UPDATE bills SET status = 'Passed' WHERE id = $1", [
            bill.id,
          ]);
        } else {
          await query("UPDATE bills SET status = 'Defeated' WHERE id = $1", [
            bill.id,
          ]);
        }
      }
    } catch (error) {
      console.error("Error processing presidential bills:", error);
      return NextResponse.json(
        { success: false, error: "Internal Server Error" },
        { status: 500 },
      );
    }

    // Senate stage: Only advance bills that have pool = currentPool (completed 24 hours)
    try {
      const res = await query(
        "SELECT * FROM bills WHERE stage = 'Senate' AND status = 'Voting' AND pool = $1",
        [currentPool],
      );

      for (const bill of res.rows) {
        const votesRes = await query(
          "SELECT vote_yes, COUNT(*) as count FROM bill_votes_senate WHERE bill_id = $1 GROUP BY vote_yes",
          [bill.id],
        );
        const yesVotes = Number(
          votesRes.rows.find((row) => row.vote_yes === true)?.count || 0,
        );
        const noVotes = Number(
          votesRes.rows.find((row) => row.vote_yes === false)?.count || 0,
        );

        if (yesVotes > noVotes) {
          // Bill passes to Presidential, keep same pool
          await query(
            "UPDATE bills SET stage = 'Presidential', status = 'Voting' WHERE id = $1",
            [bill.id],
          );
        } else {
          await query("UPDATE bills SET status = 'Defeated' WHERE id = $1", [
            bill.id,
          ]);
        }
      }
    } catch (error) {
      console.error("Error processing senate bills:", error);
      return NextResponse.json(
        { success: false, error: "Internal Server Error" },
        { status: 500 },
      );
    }

    // House stage: Only advance bills that have pool = currentPool (completed 24 hours)
    try {
      const res = await query(
        "SELECT * FROM bills WHERE stage = 'House' AND status = 'Voting' AND pool = $1",
        [currentPool],
      );

      for (const bill of res.rows) {
        const votesRes = await query(
          "SELECT vote_yes, COUNT(*) as count FROM bill_votes_house WHERE bill_id = $1 GROUP BY vote_yes",
          [bill.id],
        );
        const yesVotes = Number(
          votesRes.rows.find((row) => row.vote_yes === true)?.count || 0,
        );
        const noVotes = Number(
          votesRes.rows.find((row) => row.vote_yes === false)?.count || 0,
        );

        if (yesVotes > noVotes) {
          // Bill passes to Senate, keep same pool
          await query(
            "UPDATE bills SET stage = 'Senate', status = 'Voting' WHERE id = $1",
            [bill.id],
          );
        } else {
          await query("UPDATE bills SET status = 'Defeated' WHERE id = $1", [
            bill.id,
          ]);
        }
      }

      // Always draw a new bill and assign it the CURRENT pool number (before incrementing)
      const nextBillRes = await query(
        "SELECT * FROM bills WHERE stage = 'House' AND status = 'Queued' ORDER BY created_at ASC LIMIT 1",
      );
      if (nextBillRes.rows.length > 0) {
        const nextBill = nextBillRes.rows[0];
        await query(
          "UPDATE bills SET status = 'Voting', pool = $1 WHERE id = $2",
          [currentPool, nextBill.id],
        );
      }

      // Update bill_pool in game_tracker to next pool (AFTER drawing the bill)
      await query("UPDATE game_tracker SET bill_pool = $1", [nextPool]);

      // Cleanup: delete all parties with zero members
      try {
        // First, get parties with zero members
        const emptyPartiesRes = await query(`
        SELECT p.id FROM parties p
        WHERE NOT EXISTS (
          SELECT 1 FROM users u WHERE u.party_id = p.id
        )
      `);

        // Delete each empty party along with its stances
        for (const party of emptyPartiesRes.rows) {
          await query("DELETE FROM party_stances WHERE party_id = $1", [
            party.id,
          ]);
          await query("DELETE FROM parties WHERE id = $1", [party.id]);
          console.log(`Deleted empty party with ID: ${party.id}`);
        }
      } catch (error) {
        console.error("Error deleting zero-member parties:", error);
        // Do not fail the entire job for cleanup errors
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error advancing bill:", error);
      return NextResponse.json(
        { success: false, error: "Internal Server Error" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error processing bill advance:", error);
  }
}
