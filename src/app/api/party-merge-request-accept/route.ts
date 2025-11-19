/* eslint-disable @typescript-eslint/no-explicit-any */

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

    // Get the notification to verify it exists and get sender/receiver info
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

    const { sender_party_id, receiver_party_id } = notification.rows[0];

    // Get the leader of the sender party
    const senderParty = await query(
      "SELECT leader_id FROM parties WHERE id = $1",
      [sender_party_id]
    );

    const senderLeaderId = senderParty.rows[0]?.leader_id || null;

    // Get the merge request data
    const mergeRequest = await query(
      "SELECT * FROM merge_request WHERE id = $1",
      [mergeRequestId]
    );

    if (mergeRequest.rows.length === 0) {
      return NextResponse.json(
        { error: "Merge request data not found" },
        { status: 404 }
      );
    }

    const mergeData = mergeRequest.rows[0];

    // Check if a party with this name already exists
    const existingParty = await query(
      "SELECT id FROM parties WHERE name = $1",
      [mergeData.name]
    );

    if (existingParty.rows.length > 0) {
      return NextResponse.json(
        {
          error:
            "A party with this name already exists. The merge may have already been completed.",
        },
        { status: 400 }
      );
    }

    // Get stances for the merge request
    const mergeStances = await query(
      `SELECT stance_id, value FROM merge_request_stances 
       WHERE merge_request_id = $1`,
      [mergeRequestId]
    );

    // Create the new merged party
    const newPartyResult = await query(
      `INSERT INTO parties (name, color, bio, political_leaning, leaning, logo, leader_id, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
       RETURNING id`,
      [
        mergeData.name,
        mergeData.color,
        mergeData.bio,
        mergeData.political_leaning,
        mergeData.leaning,
        mergeData.logo,
        senderLeaderId,
      ]
    );

    const newPartyId = newPartyResult.rows[0].id;

    // Add stances to the new party
    for (const stance of mergeStances.rows) {
      await query(
        `INSERT INTO party_stances (party_id, stance_id, value) 
         VALUES ($1, $2, $3)`,
        [newPartyId, stance.stance_id, stance.value]
      );
    }

    // Transfer all members from both parties to the new party
    await query(
      `UPDATE users SET party_id = $1 
       WHERE party_id IN ($2, $3)`,
      [newPartyId, sender_party_id, receiver_party_id]
    );

    // Delete party stances for both old parties
    await query(`DELETE FROM party_stances WHERE party_id IN ($1, $2)`, [
      sender_party_id,
      receiver_party_id,
    ]);

    // Delete the old parties
    await query("DELETE FROM parties WHERE id IN ($1, $2)", [
      sender_party_id,
      receiver_party_id,
    ]);

    // Update notification status to accepted
    await query(
      `UPDATE party_notifications 
       SET status = 'Accepted' 
       WHERE merge_request_id = $1`,
      [mergeRequestId]
    );

    // Add feed item for the merge
    if (senderLeaderId) {
      await query(
        `INSERT INTO feed (user_id, content, created_at) 
         VALUES ($1, $2, NOW())`,
        [
          senderLeaderId,
          `has successfully merged two parties to create "${mergeData.name}".`,
        ]
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Merge request accepted and parties merged successfully",
        newPartyId,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error accepting merge request:", error);

    // Handle specific database errors
    if (error.code === "23505") {
      return NextResponse.json(
        {
          error:
            "A party with this name already exists. Please choose a different name.",
        },
        { status: 400 }
      );
    }

    if (error.code === "23503") {
      return NextResponse.json(
        {
          error:
            "Cannot complete merge due to foreign key constraint. Please try again.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to accept merge request",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
