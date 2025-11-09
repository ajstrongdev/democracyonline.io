import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mergeRequestId, partyId } = body;

    if (!mergeRequestId || !partyId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    const notification = await query(
      `SELECT * FROM party_notifications 
       WHERE merge_request_id = $1 
       AND receiver_party_id = $2 
       AND status = 'Pending'`,
      [mergeRequestId, partyId]
    );

    if (notification.rows.length === 0) {
      return NextResponse.json(
        { error: "Merge request not found or already processed" },
        { status: 404 }
      );
    }

    await query(
      `UPDATE party_notifications 
       SET status = 'Rejected' 
       WHERE merge_request_id = $1`,
      [mergeRequestId]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Merge request rejected successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error rejecting merge request:", error);
    return NextResponse.json(
      { error: "Failed to reject merge request" },
      { status: 500 }
    );
  }
}
