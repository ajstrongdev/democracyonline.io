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
    const res = await query("SELECT * FROM parties WHERE id = $1", [partyId]);
    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }
    return NextResponse.json(res.rows[0]);
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
