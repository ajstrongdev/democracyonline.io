import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Reset user's last_activity to 0 (case-insensitive email matching)
    const result = await query(
      "UPDATE users SET last_activity = 0 WHERE LOWER(email) = LOWER($1) RETURNING id, email, username",
      [email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    } else {
      await query(
        "UPDATE users SET is_active = TRUE WHERE LOWER(email) = LOWER($1)",
        [email]
      );
    }
    return NextResponse.json({
      success: true,
      message: "User activity reset successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Error resetting user activity:", error);
    return NextResponse.json(
      { error: "Failed to reset user activity" },
      { status: 500 }
    );
  }
}
