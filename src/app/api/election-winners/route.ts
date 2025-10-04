import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { election } = await request.json();
  if (!election) {
    return NextResponse.json(
      { error: "Election is required" },
      { status: 400 }
    );
  }
  try {
    const winners = await query(
      "SELECT * FROM candidates WHERE haswon = true AND election = $1",
      [election]
    );
    return NextResponse.json(winners.rows);
  } catch (error) {
    console.error("Error fetching election winners:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
