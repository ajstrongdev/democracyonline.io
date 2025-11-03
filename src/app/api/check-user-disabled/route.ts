import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.substring(7);

    // Verify the ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Users can only check their own status unless they're querying their own UID
    if (decodedToken.uid !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get user record from Firebase Admin
    const userRecord = await adminAuth.getUser(uid);

    return NextResponse.json({
      disabled: userRecord.disabled,
      email: userRecord.email,
      emailVerified: userRecord.emailVerified,
    });
  } catch (error) {
    console.error("Error checking user status:", error);

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "auth/user-not-found"
    ) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to check user status" },
      { status: 500 }
    );
  }
}
