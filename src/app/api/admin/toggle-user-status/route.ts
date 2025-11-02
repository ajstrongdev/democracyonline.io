import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { verifyAdminAccess, ALLOWED_ADMIN_EMAILS } from "@/lib/adminAuth";

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

    // Update user status
    await adminAuth.updateUser(uid, { disabled });

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
