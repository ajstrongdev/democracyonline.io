import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const partyId = searchParams.get("partyId");

  if (!partyId) {
    return NextResponse.json(
      { error: "Missing partyId parameter" },
      { status: 400 }
    );
  }
  try {
    const result = await query("SELECT * FROM users WHERE party_id = $1", [
      partyId,
    ]);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
