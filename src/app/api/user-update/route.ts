import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId, username, bio, political_leaning } = await request.json();

  try {
    const updateUser = await query(
      "UPDATE users SET username = $1, bio = $2, political_leaning = $3 WHERE id = $4 RETURNING *",
      [username, bio, political_leaning, userId]
    );

    if (updateUser.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(updateUser.rows[0]);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
