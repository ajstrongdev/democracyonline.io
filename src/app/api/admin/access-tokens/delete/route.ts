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

    const { tokenId } = await request.json();

    if (!tokenId) {
      return NextResponse.json(
        { error: "Token ID is required" },
        { status: 400 }
      );
    }

    // Delete token from database
    await query("DELETE FROM access_tokens WHERE id = $1", [tokenId]);

    return NextResponse.json({
      success: true,
      message: "Access token deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting access token:", error);
    return NextResponse.json(
      { error: "Failed to delete access token" },
      { status: 500 }
    );
  }
}
