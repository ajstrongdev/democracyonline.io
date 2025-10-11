import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { email, username, bio, leaning } = (await request.json()) as {
    email: string;
    username: string;
    bio: string;
    leaning: string;
  };
  try {
    const result = await query(
      "INSERT INTO users (email, username, bio, political_leaning) VALUES ($1, $2, $3, $4) RETURNING *",
      [email, username, bio, leaning]
    );
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
