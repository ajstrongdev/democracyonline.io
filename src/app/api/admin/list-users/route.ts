import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { verifyAdminAccess } from "@/lib/adminAuth";
import { query } from "@/lib/db";

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

    // Fetch usernames from database
    const emailToUsernameMap = new Map<string, string>();
    try {
      const dbUsers = await query("SELECT email, username FROM users");
      dbUsers.rows.forEach((row) => {
        if (row.email && row.username) {
          emailToUsernameMap.set(row.email, row.username);
        }
      });
    } catch (dbError) {
      console.error("Error fetching usernames from database:", dbError);
      // Continue without usernames if database query fails
    }

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
      username: userRecord.email
        ? emailToUsernameMap.get(userRecord.email)
        : undefined,
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
