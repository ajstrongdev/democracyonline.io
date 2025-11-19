import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const election = searchParams.get("election");
  if (!election) {
    return NextResponse.json(
      { error: "Election type is required" },
      { status: 400 }
    );
  }
  try {
    const res = await query("SELECT * FROM elections WHERE election = $1", [
      election,
    ]);
    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: "Election not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(res.rows[0], { status: 200 });
  } catch (error) {
    console.error("Error fetching election info:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
