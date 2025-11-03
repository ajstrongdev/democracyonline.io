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

    // Get all parties with member count
    const parties = await query(`
      SELECT
        p.*,
        COUNT(u.id) as member_count,
        u_leader.username as leader_username
      FROM parties p
      LEFT JOIN users u ON u.party_id = p.id
      LEFT JOIN users u_leader ON u_leader.id = p.leader_id
      GROUP BY p.id, u_leader.username
      ORDER BY p.created_at DESC
    `);

    return NextResponse.json({
      parties: parties.rows,
    });
  } catch (error) {
    console.error("Error listing parties:", error);
    return NextResponse.json(
      { error: "Failed to list parties" },
      { status: 500 }
    );
  }
}
