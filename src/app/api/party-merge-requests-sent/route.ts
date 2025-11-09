import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get("partyId");

    if (!partyId) {
      return NextResponse.json(
        { error: "Party ID is required" },
        { status: 400 }
      );
    }
    // Get all pending merge requests sent by this party
    const mergeRequests = await query(
      `SELECT 
        pn.merge_request_id,
        pn.sender_party_id,
        pn.receiver_party_id,
        pn.status,
        pn.created_at,
        mr.id,
        mr.name,
        mr.color,
        mr.bio,
        mr.political_leaning,
        mr.leaning,
        mr.logo,
        rp.name as receiver_party_name,
        rp.color as receiver_party_color
       FROM party_notifications pn
       JOIN merge_request mr ON pn.merge_request_id = mr.id
       JOIN parties rp ON pn.receiver_party_id = rp.id
       WHERE pn.sender_party_id = $1 
       AND pn.status = 'Pending'
       ORDER BY pn.created_at DESC`,
      [partyId]
    );

    // For each merge request, get its stances
    const mergeRequestsWithStances = await Promise.all(
      mergeRequests.rows.map(async (request) => {
        const stances = await query(
          `SELECT 
            mrs.value,
            st.issue,
            st.description
           FROM merge_request_stances mrs
           JOIN political_stances st ON mrs.stance_id = st.id
           WHERE mrs.merge_request_id = $1`,
          [request.id]
        );

        return {
          id: request.merge_request_id,
          mergeData: {
            name: request.name,
            color: request.color,
            bio: request.bio,
            leaning: request.leaning,
            logo: request.logo,
            stances: stances.rows,
          },
          receiverParty: {
            id: request.receiver_party_id,
            name: request.receiver_party_name,
            color: request.receiver_party_color,
          },
          status: request.status,
          createdAt: request.created_at,
        };
      })
    );

    return NextResponse.json(mergeRequestsWithStances, { status: 200 });
  } catch (error) {
    console.error("Error fetching sent merge requests:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return NextResponse.json(
      {
        error: "Failed to fetch sent merge requests",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
