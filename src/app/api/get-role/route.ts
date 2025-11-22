import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");

  try {
    const res = await query(
      "SELECT id, username, bio, political_leaning, role, party_id, created_at FROM users WHERE role = $1 AND username NOT LIKE 'Banned User%' AND is_active = TRUE",
      [role]
    );
    return NextResponse.json({ representatives: res.rows }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch representatives" },
      { status: 500 }
    );
  }
}
