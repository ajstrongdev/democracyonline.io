import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { email, username } = (await request.json()) as {
    email: string;
    username: string;
  };
  try {
    const result = await query(
      "INSERT INTO users (email, username) VALUES ($1, $2) RETURNING *",
      [email, username]
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
