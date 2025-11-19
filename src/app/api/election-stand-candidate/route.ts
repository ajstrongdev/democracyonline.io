import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId, election } = await request.json();
  if (!userId || !election) {
    return NextResponse.json(
      { error: "userId and election are required" },
      { status: 400 }
    );
  }
  try {
    const res = await query(
      "INSERT INTO candidates (user_id, election) VALUES ($1, $2) RETURNING *",
      [userId, election]
    );
    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error adding election candidate:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
