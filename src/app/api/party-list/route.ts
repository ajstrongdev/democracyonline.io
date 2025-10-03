import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const res = await query("SELECT * FROM parties");
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
