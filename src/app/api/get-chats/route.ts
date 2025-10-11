import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { room } = await request.json();
  if (!room) {
    return NextResponse.json({ error: "Room is required" }, { status: 400 });
  }
  try {
    const res = await query(
      "SELECT * FROM chats WHERE room = $1 ORDER BY created_at DESC LIMIT 50",
      [room]
    );
    return NextResponse.json({ chats: res.rows }, { status: 200 });
  } catch (error) {
    console.error("Error fetching chats:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
