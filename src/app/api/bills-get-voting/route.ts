import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage");
  try {
    const res = await query(
      "SELECT * FROM bills WHERE status = 'Voting' AND stage = $1",
      [stage]
    );
    return NextResponse.json({ bills: res.rows }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch house bills" },
      { status: 500 }
    );
  }
}
