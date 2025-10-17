import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json(
      { error: "Missing userId in request body" },
      { status: 400 }
    );
  }

  try {
    await query("UPDATE users SET party_id = NULL WHERE id = $1", [userId]);
    return NextResponse.json({
      status: 200,
      message: "Member kicked from party successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to kick member from party" },
      { status: 500 }
    );
  }
}
