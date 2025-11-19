import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { email } = (await request.json()) as { email: string };
  try {
    const result = await query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    } else {
      return NextResponse.json(result.rows[0]);
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
