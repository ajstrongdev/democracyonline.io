import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token is required" },
        { status: 400 }
      );
    }

    // Check if token exists in database
    const result = await query("SELECT * FROM access_tokens WHERE token = $1", [
      token,
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json({
        valid: false,
        error: "Invalid access token",
      });
    }

    // Token is valid
    return NextResponse.json({
      valid: true,
      tokenId: result.rows[0].id,
    });
  } catch (error) {
    console.error("Error validating access token:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate access token" },
      { status: 500 }
    );
  }
}
