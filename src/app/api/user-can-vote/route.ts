import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json(
        { canVote: false, error: "Missing parameters" },
        { status: 400 }
      );
    }
    const res = await query("SELECT * FROM users WHERE id = $1 AND role = $2", [
      userId,
      role,
    ]);
    if (res.rows.length === 0) {
      return NextResponse.json(
        { canVote: false, error: "User not found or invalid role" },
        { status: 200 }
      );
    } else {
      return NextResponse.json({ canVote: true }, { status: 200 });
    }
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { canVote: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
