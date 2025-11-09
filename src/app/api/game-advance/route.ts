import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { OAuth2Client } from "google-auth-library";

const oAuth2Client = new OAuth2Client();

function calculate(x: number) {
  return Math.ceil(x * 0.15);
}

async function updateSenateSeats() {
  // Determine number of seats based on total player count (excluding banned users)
  const usersRes = await query(
    "SELECT COUNT(*) FROM users WHERE username NOT LIKE 'Banned User%'"
  );
  const population = usersRes.rows[0]?.count || 0;
  const senators = Math.max(1, calculate(population));

  await query("UPDATE elections SET seats = $1 WHERE election = 'Senate'", [
    senators,
  ]);
}

export async function GET(request: NextRequest) {
  // Validate OIDC token from Cloud Scheduler
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error("Missing or invalid Authorization header");
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    // Verify the OIDC token
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
        { status: 401 }
      );
    }

    console.log("Authenticated request from:", payload.email);
  } catch (error) {
    console.error("Token validation failed:", error);
    return NextResponse.json(
      { success: false, error: "Unauthorized - Invalid token" },
      { status: 401 }
    );
  }

  // Presidential elections
  try {
    const res = await query(
      // Get "status" of presidential election
      "SELECT * FROM elections WHERE election = 'President'"
    );
    const electionStatus = res.rows[0]?.status;
    const daysLeft = res.rows[0]?.days_left;
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
        const topVotes = Number(winner?.votes || 0);
        const tiedCandidates = candidatesRes.rows.filter(
          (c) => Number(c.votes) === topVotes
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
          await query("INSERT INTO feed (user_id, content) VALUES ($1, $2)", [
            winner.user_id,
            `has been elected as the President!`,
          ]);
        }
        // Move to "Concluded" status regardless of whether there was a winner
        await query(
          "UPDATE elections SET status = 'Concluded', days_left = 4 WHERE election = 'President'"
        );
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
  // Senate elections
  try {
    // Get "status" of senate election
    const res = await query(
      "SELECT * FROM elections WHERE election = 'Senate'"
    );
    const electionStatus = res.rows[0]?.status;
    const daysLeft = res.rows[0]?.days_left;
    if (electionStatus === "Candidate") {
      if (daysLeft > 1) {
        // Decrement days left
        await query(
          "UPDATE elections SET days_left = days_left - 1 WHERE election = 'Senate'"
        );
      } else {
        // Update seats before transitioning to voting
        await updateSenateSeats();
        // Transition to "Voting" phase and set days_left to 2 for voting period
        await query(
          "UPDATE elections SET status = 'Voting', days_left = 2 WHERE election = 'Senate'"
        );
      }
    }
    if (electionStatus === "Voting") {
      if (daysLeft > 1) {
        // Decrement days left
        await query(
          "UPDATE elections SET days_left = days_left - 1 WHERE election = 'Senate'"
        );
      } else {
        // Remove all users with role "Senator" before electing new ones
        await query(
          "UPDATE users SET role = 'Representative' WHERE role = 'Senator'"
        );
        // Election ends, determine winners
        const seatsRes = await query(
          "SELECT seats FROM elections WHERE election = 'Senate'"
        );
        const seats = seatsRes.rows[0]?.seats || 1;

        // Fetch ALL candidates to properly handle ties
        const candidatesRes = await query(
          "SELECT * FROM candidates WHERE election = 'Senate' ORDER BY votes DESC"
        );

        const allCandidates = candidatesRes.rows;
        if (allCandidates.length > 0) {
          // Get the vote threshold for the last seat
          const provisionalWinners = allCandidates.slice(0, seats);
          const lastWinnerVotes = Number(
            provisionalWinners[provisionalWinners.length - 1].votes
          );

          // Find all candidates tied with the last seat
          const tiedCandidates = allCandidates.filter(
            (c) => Number(c.votes) === lastWinnerVotes
          );

          let winners;
          if (tiedCandidates.length > 1) {
            // Tie detected - get non-tied winners and randomly select from tied candidates
            const nonTiedWinners = allCandidates.filter(
              (w) => Number(w.votes) > lastWinnerVotes
            );
            const tiedSeats = seats - nonTiedWinners.length;
            const shuffledTiedCandidates = tiedCandidates.sort(
              () => 0.5 - Math.random()
            );
            const selectedTiedWinners = shuffledTiedCandidates.slice(
              0,
              tiedSeats
            );
            winners = nonTiedWinners.concat(selectedTiedWinners);
          } else {
            winners = provisionalWinners;
          }

          // Update the role of the winning users to "Senator"
          const winnerIds = winners.map((w) => w.user_id);
          await query(
            `UPDATE users SET role = 'Senator' WHERE id = ANY($1::int[])`,
            [winnerIds]
          );
          // Add feed entries for each new senator
          for (const winner of winners) {
            await query("INSERT INTO feed (user_id, content) VALUES ($1, $2)", [
              winner.user_id,
              `has been elected as a Senator!`,
            ]);
          }
        }
        // Move to "Concluded" status regardless of whether there were candidates
        await query(
          "UPDATE elections SET status = 'Concluded', days_left = 3 WHERE election = 'Senate'"
        );
      }
    } else if (electionStatus === "Concluded") {
      if (daysLeft > 1) {
        // Decrement days left
        await query(
          "UPDATE elections SET days_left = days_left - 1 WHERE election = 'Senate'"
        );
      } else {
        // Reset election to "Candidate" phase for next cycle
        await query("DELETE FROM candidates WHERE election = 'Senate'");
        await query("DELETE FROM votes WHERE election = 'Senate'");
        await query(
          "UPDATE elections SET status = 'Candidate', days_left = 2 WHERE election = 'Senate'"
        );
      }
    }
  } catch (error) {
    console.error("Error handling senate election status:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
