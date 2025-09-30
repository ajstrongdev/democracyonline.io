import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  // Get userid
  const { searchParams } = new URL(request.url); // URL will be https://localhost:3000/api/dev-quick-demote?userId=1
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "Missing userId parameter" },
      { status: 400 }
    );
  }
  try {
    const userRes = await query("SELECT role FROM users WHERE id = $1", [
      userId,
    ]);
    if (
      userRes.rows.length === 0 ||
      !["Representative", "Senator", "President"].includes(userRes.rows[0].role)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    // Demote president to senator or senator to representative
    if (userRes.rows[0].role === "President") {
      await query("UPDATE users SET role = 'Senator' WHERE id = $1", [userId]);
    } else if (userRes.rows[0].role === "Senator") {
      await query("UPDATE users SET role = 'Representative' WHERE id = $1", [
        userId,
      ]);
    } else {
      return NextResponse.json(
        { error: "User is already Representative" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
