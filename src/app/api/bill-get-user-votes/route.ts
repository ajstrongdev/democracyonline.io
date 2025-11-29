import { NextRequest } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const houseVotes = await query(
    `SELECT bill_votes_house.*, bills.title, bills.stage, bills.status 
     FROM bill_votes_house 
     INNER JOIN bills ON bill_votes_house.bill_id = bills.id 
     WHERE bill_votes_house.voter_id = $1
     ORDER BY bill_votes_house.id`,
    [userId]
  );
  const senateVotes = await query(
    `SELECT bill_votes_senate.*, bills.title, bills.stage, bills.status 
     FROM bill_votes_senate 
     INNER JOIN bills ON bill_votes_senate.bill_id = bills.id 
     WHERE bill_votes_senate.voter_id = $1
     ORDER BY bill_votes_senate.id`,
    [userId]
  );
  const presidentialVotes = await query(
    `SELECT bill_votes_presidential.*, bills.title, bills.stage, bills.status 
     FROM bill_votes_presidential 
     INNER JOIN bills ON bill_votes_presidential.bill_id = bills.id 
     WHERE bill_votes_presidential.voter_id = $1
     ORDER BY bill_votes_presidential.id`,
    [userId]
  );

  const allVotes = [
    ...houseVotes.rows,
    ...senateVotes.rows,
    ...presidentialVotes.rows,
  ].sort((a, b) => a.id - b.id);

  return new Response(JSON.stringify({ votes: allVotes }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
