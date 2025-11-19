import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Verify the ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    return NextResponse.json({
      authenticated: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
      },
    });
  } catch (error) {
    console.error("Session verification error:", error);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
