import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { adminAuth } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json(
      { error: "Missing userId parameter" },
      { status: 400 }
    );
  }
  try {
    const res = await query("SELECT * FROM users WHERE id = $1", [userId]);
    if (res.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = res.rows[0];

    // Check if user is disabled in Firebase
    try {
      const firebaseUser = await adminAuth.getUserByEmail(user.email);
      if (firebaseUser.disabled) {
        return NextResponse.json(
          { error: "User is disabled" },
          { status: 403 }
        );
      }
    } catch (firebaseError) {
      console.error("Error checking Firebase user status:", firebaseError);
      // If Firebase check fails, continue returning the user data
      // This prevents breaking the app if Firebase is temporarily unavailable
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
