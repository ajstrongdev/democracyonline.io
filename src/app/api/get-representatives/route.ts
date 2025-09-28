import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const res = await query(
      "SELECT * FROM users WHERE role = 'Representative'"
    );
    return NextResponse.json({ representatives: res.rows }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch representatives" },
      { status: 500 }
    );
  }
}
