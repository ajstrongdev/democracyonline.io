import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const res = await query("SELECT * FROM political_stances ORDER BY id ASC");
    return NextResponse.json({ types: res.rows }, { status: 200 });
  } catch (error) {
    console.error("Error fetching types:", error);
    return NextResponse.json(
      { error: "Failed to fetch types" },
      { status: 500 }
    );
  }
}
