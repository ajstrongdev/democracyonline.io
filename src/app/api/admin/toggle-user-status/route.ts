import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { verifyAdminAccess, ALLOWED_ADMIN_EMAILS } from "@/lib/adminAuth";
import { handleUserBan } from "@/lib/userBanActions";

export async function POST(request: NextRequest) {
  try {
    // Verify admin access using Firebase ID token
    const adminEmail = await verifyAdminAccess(request);

    if (!adminEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { uid, disabled } = await request.json();

    if (!uid || typeof disabled !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get the target user's information
    const targetUser = await adminAuth.getUser(uid);

    // Prevent disabling admin accounts
    if (targetUser.email && ALLOWED_ADMIN_EMAILS.includes(targetUser.email)) {
      return NextResponse.json(
        { error: "Cannot disable admin accounts" },
        { status: 403 }
      );
    }

    // Update user status in Firebase
    await adminAuth.updateUser(uid, { disabled });

    // If disabling user, handle database cleanup
    if (disabled && targetUser.email) {
      try {
        await handleUserBan(uid, targetUser.email);
      } catch (dbError) {
        console.error("Error during user ban database cleanup:", dbError);
        // Continue even if DB cleanup fails - Firebase disable succeeded
      }
    }

    return NextResponse.json({
      success: true,
      uid,
      disabled,
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    return NextResponse.json(
      { error: "Failed to update user status" },
      { status: 500 }
    );
  }
}
