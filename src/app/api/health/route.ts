import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: "unknown", error: null as string | null },
      environment: {
        hasConnectionString: !!process.env.CONNECTION_STRING,
        hasFirebaseAdminProjectId: !!process.env.FIREBASE_ADMIN_PROJECT_ID,
        hasFirebaseAdminClientEmail: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        hasFirebaseAdminPrivateKey: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
        nodeEnv: process.env.NODE_ENV,
      },
    },
  };

  // Test database connection
  try {
    await query("SELECT 1");
    health.checks.database.status = "ok";
  } catch (error) {
    health.checks.database.status = "error";
    health.checks.database.error =
      error instanceof Error ? error.message : "Unknown database error";
    health.status = "degraded";
  }

  const statusCode = health.status === "ok" ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
}
