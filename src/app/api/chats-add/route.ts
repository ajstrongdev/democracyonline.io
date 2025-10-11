import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { user_id, room, username, message } = await request.json();

  try {
    await query(
      "INSERT INTO chats (user_id, room, username, message) VALUES ($1, $2, $3, $4)",
      [user_id, room, username, message]
    );

    return NextResponse.json({ message: "Chat added" }, { status: 201 });
  } catch (error) {
    console.error("Error adding chat:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
