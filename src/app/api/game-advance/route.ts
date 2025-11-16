import { OAuth2Client } from "google-auth-library";
import { type NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

const oAuth2Client = new OAuth2Client();

interface CandidateRow {
  id: number | string;
  user_id: number | string;
  election: string;
  votes: number | null;
  created_at: string | Date;
}

async function updateSenateSeats() {
  // Get count of declared candidates for Senate election
  const candidatesRes = await query(
    "SELECT COUNT(*)::int FROM candidates WHERE election = 'Senate'",
  );
  const candidateCount = Number(candidatesRes.rows[0]?.count || 0);

  // Calculate seats: minimum 3 or 50% of candidates, whichever is higher
  const halfCandidates = Math.ceil(candidateCount * 0.5);
  const seats = Math.max(3, halfCandidates);

  await query("UPDATE elections SET seats = $1 WHERE election = 'Senate'", [
    seats,
  ]);
}

async function electPresident(): Promise<void> {
  // Remove all users with role "President" before electing new one
  await query(
    "UPDATE users SET role = 'Representative' WHERE role = 'President'",
  );

  // Election ends, determine winner
  const candidatesRes = await query(
    "SELECT * FROM candidates WHERE election = 'President' ORDER BY votes DESC",
  );

  const allCandidates = candidatesRes.rows as CandidateRow[];

  if (allCandidates.length === 0) {
    return;
  }

  const topVotes = Number(allCandidates[0]?.votes || 0);
  const tiedCandidates = allCandidates.filter(
    (c) => Number(c.votes) === topVotes,
  );

  const winner: CandidateRow =
    tiedCandidates.length > 1
      ? tiedCandidates[Math.floor(Math.random() * tiedCandidates.length)]
      : allCandidates[0];

  // Update the role of the winning user to "President"
  await query("UPDATE users SET role = 'President' WHERE id = $1", [
    winner.user_id,
  ]);
  await query("INSERT INTO feed (user_id, content) VALUES ($1, $2)", [
    winner.user_id,
    `has been elected as the President!`,
  ]);
}

async function electSenators(): Promise<void> {
  // Remove all users with role "Senator" before electing new ones
  await query(
    "UPDATE users SET role = 'Representative' WHERE role = 'Senator'",
  );

  // Get seat count
  const seatsRes = await query(
    "SELECT seats FROM elections WHERE election = 'Senate'",
  );
  const seats = Number(seatsRes.rows[0]?.seats || 1);

  // Fetch ALL candidates to properly handle ties
  const candidatesRes = await query(
    "SELECT * FROM candidates WHERE election = 'Senate' ORDER BY votes DESC",
  );

  const allCandidates = candidatesRes.rows as CandidateRow[];

  if (allCandidates.length === 0) {
    return;
  }

  // Get the vote threshold for the last seat
  const provisionalWinners = allCandidates.slice(0, seats);
  const lastWinnerVotes = Number(
    provisionalWinners[provisionalWinners.length - 1]?.votes || 0,
  );

  // Find all candidates tied with the last seat
  const tiedCandidates = allCandidates.filter(
    (c) => Number(c.votes) === lastWinnerVotes,
  );

  // Determine winners with tie-breaking
  const winners: CandidateRow[] =
    tiedCandidates.length > 1
      ? (() => {
          const nonTiedWinners = allCandidates.filter(
            (w) => Number(w.votes) > lastWinnerVotes,
          );
          const tiedSeats = seats - nonTiedWinners.length;
          const shuffledTiedCandidates = tiedCandidates.sort(
            () => 0.5 - Math.random(),
          );
          const selectedTiedWinners = shuffledTiedCandidates.slice(
            0,
            tiedSeats,
          );
          return nonTiedWinners.concat(selectedTiedWinners);
        })()
      : provisionalWinners;

  // Update the role of the winning users to "Senator"
  const winnerIds: (number | string)[] = winners.map((w) => w.user_id);
  await query(`UPDATE users SET role = 'Senator' WHERE id = ANY($1::int[])`, [
    winnerIds,
  ]);

  // Add feed entries for each new senator
  for (const winner of winners) {
    await query("INSERT INTO feed (user_id, content) VALUES ($1, $2)", [
      winner.user_id,
      `has been elected as a Senator!`,
    ]);
  }

  // If we still have fewer senators than seats, fill remaining seats
  const remaining = Math.max(0, seats - winners.length);
  if (remaining > 0) {
    const fillerRes = await query(
      `
      SELECT id AS user_id
      FROM users
      WHERE username NOT LIKE 'Banned User%'
        AND role NOT IN ('President', 'Senator')
        AND id <> ALL($1::int[])
      ORDER BY RANDOM()
      LIMIT $2
      `,
      [winnerIds.length > 0 ? winnerIds : [0], remaining],
    );

    const fillers: Array<{ user_id: number | string }> =
      (fillerRes.rows as Array<{ user_id: number | string }>) || [];
    if (fillers.length > 0) {
      const fillerIds = fillers.map((f) => f.user_id);
      await query(
        `UPDATE users SET role = 'Senator' WHERE id = ANY($1::int[])`,
        [fillerIds],
      );
      for (const filler of fillers) {
        await query("INSERT INTO feed (user_id, content) VALUES ($1, $2)", [
          filler.user_id,
          `has been appointed as a Senator!`,
        ]);
      }
    }
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Validate OIDC token from Cloud Scheduler
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    console.error("Missing or invalid Authorization header");
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
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
    // Presidential elections
    const presRes = await query(
      "SELECT status, days_left FROM elections WHERE election = 'President'",
    );
    const presStatus = presRes.rows[0]?.status;
    const presDaysLeft = presRes.rows[0]?.days_left;
    if (presStatus === "Candidate") {
      if (presDaysLeft > 1) {
        // Decrement days left
        await query(
          "UPDATE elections SET days_left = days_left - 1 WHERE election = 'President'",
        );
      } else {
        // Transition to "Voting" phase and set days_left to 5 for voting period
        await query(
          "UPDATE elections SET status = 'Voting', days_left = 5 WHERE election = 'President'",
        );
      }
    } else if (presStatus === "Voting") {
      if (presDaysLeft > 1) {
        // Decrement days left
        await query(
          "UPDATE elections SET days_left = days_left - 1 WHERE election = 'President'",
        );
      } else {
        await electPresident();
        // Move to "Concluded" status regardless of whether there was a winner
        await query(
          "UPDATE elections SET status = 'Concluded', days_left = 4 WHERE election = 'President'",
        );
      }
    } else if (presStatus === "Concluded") {
      if (presDaysLeft > 1) {
        // Decrement days left
        await query(
          "UPDATE elections SET days_left = days_left - 1 WHERE election = 'President'",
        );
      } else {
        // Reset election to "Candidate" phase for next cycle
        await query("DELETE FROM candidates WHERE election = 'President'");
        await query("DELETE FROM votes WHERE election = 'President'");
        await query(
          "UPDATE elections SET status = 'Candidate', days_left = 5 WHERE election = 'President'",
        );
      }
    }

    // Senate elections
    const senRes = await query(
      "SELECT status, days_left FROM elections WHERE election = 'Senate'",
    );
    const senStatus = senRes.rows[0]?.status;
    const senDaysLeft = senRes.rows[0]?.days_left;

    if (senStatus === "Candidate") {
      if (senDaysLeft > 1) {
        // Decrement days left
        await query(
          "UPDATE elections SET days_left = days_left - 1 WHERE election = 'Senate'",
        );
      } else {
        // Update seats before transitioning to voting
        await updateSenateSeats();
        // Transition to "Voting" phase and set days_left to 2 for voting period
        await query(
          "UPDATE elections SET status = 'Voting', days_left = 2 WHERE election = 'Senate'",
        );
      }
    }
    if (senStatus === "Voting") {
      if (senDaysLeft > 1) {
        // Decrement days left
        await query(
          "UPDATE elections SET days_left = days_left - 1 WHERE election = 'Senate'",
        );
      } else {
        await electSenators();
        // Move to "Concluded" status regardless of whether there were candidates
        await query(
          "UPDATE elections SET status = 'Concluded', days_left = 3 WHERE election = 'Senate'",
        );
      }
    } else if (senStatus === "Concluded") {
      if (senDaysLeft > 1) {
        // Decrement days left
        await query(
          "UPDATE elections SET days_left = days_left - 1 WHERE election = 'Senate'",
        );
      } else {
        // Reset election to "Candidate" phase for next cycle
        await query("DELETE FROM candidates WHERE election = 'Senate'");
        await query("DELETE FROM votes WHERE election = 'Senate'");
        await query(
          "UPDATE elections SET status = 'Candidate', days_left = 2 WHERE election = 'Senate'",
        );
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error handling election status:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
