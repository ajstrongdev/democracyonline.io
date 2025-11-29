import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const totalResult = await query(
      "SELECT COUNT(*) as count FROM users WHERE username NOT LIKE 'Banned User%'"
    );

    const activeResult = await query(
      "SELECT COUNT(*) as count FROM users WHERE last_activity <= 7 AND username NOT LIKE 'Banned User%'"
    );

    return NextResponse.json({
      total: parseInt(totalResult.rows[0].count),
      active: parseInt(activeResult.rows[0].count),
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch user stats" },
      { status: 500 }
    );
  }
}
