import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { senderPartyId, receiverPartyId, mergedPartyData } = body;

    if (!senderPartyId || !receiverPartyId || !mergedPartyData) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate that both parties exist
    const senderParty = await query(
      "SELECT id, name FROM parties WHERE id = $1",
      [senderPartyId]
    );

    const receiverParty = await query(
      "SELECT id, name FROM parties WHERE id = $1",
      [receiverPartyId]
    );

    if (senderParty.rows.length === 0 || receiverParty.rows.length === 0) {
      return NextResponse.json(
        { error: "One or both parties not found" },
        { status: 404 }
      );
    }

    // Check if a pending merge request already exists between these parties
    const existingRequest = await query(
      `SELECT pn.* FROM party_notifications pn
       WHERE pn.sender_party_id = $1 
       AND pn.receiver_party_id = $2 
       AND pn.status = 'Pending'`,
      [senderPartyId, receiverPartyId]
    );

    if (existingRequest.rows.length > 0) {
      return NextResponse.json(
        { error: "A pending merge request already exists with this party" },
        { status: 400 }
      );
    }

    // Create the merge request with the merged party data
    const mergeRequestResult = await query(
      `INSERT INTO merge_request 
       (name, color, bio, political_leaning, leaning, logo) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id`,
      [
        mergedPartyData.name,
        mergedPartyData.color,
        mergedPartyData.bio,
        mergedPartyData.leaning,
        mergedPartyData.leaning,
        mergedPartyData.logo,
      ]
    );

    const mergeRequestId = mergeRequestResult.rows[0].id;

    // Insert stances for the merge request if provided
    if (
      mergedPartyData.stanceValues &&
      mergedPartyData.stanceValues.length > 0
    ) {
      for (const stance of mergedPartyData.stanceValues) {
        if (stance.value) {
          await query(
            `INSERT INTO merge_request_stances (merge_request_id, stance_id, value) 
             VALUES ($1, $2, $3)`,
            [mergeRequestId, stance.id, stance.value]
          );
        }
      }
    }

    // Create party notification
    await query(
      `INSERT INTO party_notifications 
       (sender_party_id, receiver_party_id, merge_request_id, status) 
       VALUES ($1, $2, $3, 'Pending')`,
      [senderPartyId, receiverPartyId, mergeRequestId]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Merge request created successfully",
        mergeRequestId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating merge request:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return NextResponse.json(
      {
        error: "Failed to create merge request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
