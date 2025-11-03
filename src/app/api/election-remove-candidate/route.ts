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
      "DELETE FROM candidates WHERE user_id = $1 AND election = $2 RETURNING *",
      [userId, election]
    );

    if (res.rowCount === 0) {
      return NextResponse.json(
        { error: "Candidacy not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Candidacy dropped successfully", candidate: res.rows[0] },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error revoking election candidate:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
