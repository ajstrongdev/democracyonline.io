import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { oldEmail, newEmail } = await request.json();

  try {
    const updateEmail = await query(
      "UPDATE users SET email = $1 WHERE email = $2 RETURNING *",
      [newEmail, oldEmail]
    );

    if (updateEmail.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(updateEmail.rows[0]);
  } catch (error) {
    console.error("Error updating email:", error);
    return NextResponse.json(
      { error: "Failed to update email" },
      { status: 500 }
    );
  }
}
