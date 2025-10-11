import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const election = searchParams.get("election");
  if (!election) {
    return NextResponse.json(
      { error: "Election is required" },
      { status: 400 }
    );
  }
  const candidates = await query(
    `
    SELECT 
      candidates.*,
      users.username,
      parties.color
    FROM candidates
    INNER JOIN users ON candidates.user_id = users.id
    LEFT JOIN parties ON users.party_id = parties.id
    WHERE candidates.election = $1
    `,
    [election]
  );
  return NextResponse.json(candidates.rows);
}
