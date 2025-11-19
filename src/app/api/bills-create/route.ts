import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  const { title, content, creator_id } = (await request.json()) as {
    title: string;
    content: string;
    creator_id: number;
  };
  try {
    const result = await query(
      "INSERT INTO bills (title, content, creator_id) VALUES ($1, $2, $3) RETURNING *",
      [title, content, creator_id]
    );
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create bill" },
      { status: 500 }
    );
  }
}
