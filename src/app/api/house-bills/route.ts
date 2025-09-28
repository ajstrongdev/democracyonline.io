import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const res = await query(
      "SELECT * FROM bills WHERE status = 'Voting' AND stage = 'House'"
    );
    return NextResponse.json({ bills: res.rows }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch house bills" },
      { status: 500 }
    );
  }
}
