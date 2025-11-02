import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { verifyAdminAccess } from "@/lib/adminAuth";

export async function POST(request: NextRequest) {
  try {
    // Verify admin access using Firebase ID token
    const adminEmail = await verifyAdminAccess(request);

    if (!adminEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { maxResults = 1000, pageToken } = await request.json();

    // List all users
    const listUsersResult = await adminAuth.listUsers(maxResults, pageToken);

    const users = listUsersResult.users.map((userRecord) => ({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      photoURL: userRecord.photoURL,
      disabled: userRecord.disabled,
      emailVerified: userRecord.emailVerified,
      creationTime: userRecord.metadata.creationTime,
      lastSignInTime: userRecord.metadata.lastSignInTime,
      providerData: userRecord.providerData,
    }));

    return NextResponse.json({
      users,
      pageToken: listUsersResult.pageToken,
    });
  } catch (error) {
    console.error("Error listing users:", error);
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500 }
    );
  }
}
