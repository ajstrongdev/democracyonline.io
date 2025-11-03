import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/adminAuth";
import { deleteParty } from "@/lib/userBanActions";

export async function POST(request: NextRequest) {
  try {
    // Verify admin access using Firebase ID token
    const adminEmail = await verifyAdminAccess(request);

    if (!adminEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { partyId } = await request.json();

    if (!partyId) {
      return NextResponse.json({ error: "Missing party ID" }, { status: 400 });
    }

    // Delete the party and remove all members
    await deleteParty(partyId);

    return NextResponse.json({
      success: true,
      message: "Party deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting party:", error);
    return NextResponse.json(
      { error: "Failed to delete party" },
      { status: 500 }
    );
  }
}
