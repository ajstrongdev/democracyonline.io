import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/adminAuth";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    // Verify admin access using Firebase ID token
    const adminEmail = await verifyAdminAccess(request);

    if (!adminEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Fetch all access tokens
    const result = await query(
      "SELECT * FROM access_tokens ORDER BY created_at DESC"
    );

    return NextResponse.json({
      success: true,
      tokens: result.rows,
    });
  } catch (error) {
    console.error("Error listing access tokens:", error);
    return NextResponse.json(
      { error: "Failed to list access tokens" },
      { status: 500 }
    );
  }
}
