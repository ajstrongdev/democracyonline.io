import { NextResponse, NextRequest } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { candidate } = await request.json();
  const result = await query("SELECT * FROM candidates WHERE user_id = $1", [
    candidate,
  ]);
  return NextResponse.json({
    isCandidate: result.rows.length > 0,
  });
}
