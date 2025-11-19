import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Token is required" },
        { status: 400 }
      );
    }

    // Delete token from database
    const result = await query(
      "DELETE FROM access_tokens WHERE token = $1 RETURNING *",
      [token]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Token not found",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Access token consumed successfully",
    });
  } catch (error) {
    console.error("Error consuming access token:", error);
    return NextResponse.json(
      { success: false, error: "Failed to consume access token" },
      { status: 500 }
    );
  }
}
