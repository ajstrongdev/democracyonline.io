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

    // Generate a random base64 token
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Buffer.from(randomBytes)
      .toString("base64")
      .replace(/[+/=]/g, "");

    // Insert token into database
    const result = await query(
      "INSERT INTO access_tokens (token) VALUES ($1) RETURNING *",
      [token]
    );

    return NextResponse.json({
      success: true,
      token: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating access token:", error);
    return NextResponse.json(
      { error: "Failed to create access token" },
      { status: 500 }
    );
  }
}
