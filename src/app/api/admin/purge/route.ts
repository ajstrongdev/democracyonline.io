import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyAdminAccess } from "@/lib/adminAuth";

/**
 * Purge a user and all their associated data from the database
 * DELETE /api/admin/purge?userId=123
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify admin access using Firebase ID token
    const adminEmail = await verifyAdminAccess(request);
    if (!adminEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get userId from query params
    const searchParams = request.nextUrl.searchParams;
    const userIdParam = searchParams.get("userId");

    if (!userIdParam) {
      return NextResponse.json(
        { success: false, error: "userId parameter is required" },
        { status: 400 }
      );
    }

    const userId = parseInt(userIdParam, 10);
    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: "userId must be a valid number" },
        { status: 400 }
      );
    }

    // Verify user exists
    const userCheck = await query(
      "SELECT id, email, username FROM users WHERE id = $1",
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const user = userCheck.rows[0];
    console.log(
      `Admin ${adminEmail} is purging user ${user.username} (${user.email}, ID: ${userId})`
    );

    // Start transaction to ensure all deletions succeed or none do
    await query("BEGIN");

    try {
      // 1. Delete user's bill votes (all chambers)
      const houseVotesResult = await query(
        "DELETE FROM bill_votes_house WHERE voter_id = $1",
        [userId]
      );
      const senateVotesResult = await query(
        "DELETE FROM bill_votes_senate WHERE voter_id = $1",
        [userId]
      );
      const presidentialVotesResult = await query(
        "DELETE FROM bill_votes_presidential WHERE voter_id = $1",
        [userId]
      );

      // 2. Delete user's election votes
      const electionVotesResult = await query(
        "DELETE FROM votes WHERE user_id = $1",
        [userId]
      );

      // 3. Delete user's candidacies
      const candidaciesResult = await query(
        "DELETE FROM candidates WHERE user_id = $1",
        [userId]
      );

      // 4. Set bills created by user to have NULL creator_id
      const billsResult = await query(
        "UPDATE bills SET creator_id = NULL WHERE creator_id = $1",
        [userId]
      );

      // 5. Delete user's feed posts
      const feedResult = await query("DELETE FROM feed WHERE user_id = $1", [
        userId,
      ]);

      // 6. Delete user's chat messages
      const chatsResult = await query("DELETE FROM chats WHERE user_id = $1", [
        userId,
      ]);

      // 7. Set party leader_id to NULL if user is a party leader
      const partyLeaderResult = await query(
        "UPDATE parties SET leader_id = NULL WHERE leader_id = $1",
        [userId]
      );

      // 8. Remove user from their party (set party_id to NULL before deletion)
      await query("UPDATE users SET party_id = NULL WHERE id = $1", [userId]);

      // 9. Finally, delete the user
      const userDeleteResult = await query("DELETE FROM users WHERE id = $1", [
        userId,
      ]);

      // Commit transaction
      await query("COMMIT");

      const deletionSummary = {
        user: user.username,
        email: user.email,
        deletedRecords: {
          billVotesHouse: houseVotesResult.rowCount || 0,
          billVotesSenate: senateVotesResult.rowCount || 0,
          billVotesPresidential: presidentialVotesResult.rowCount || 0,
          electionVotes: electionVotesResult.rowCount || 0,
          candidacies: candidaciesResult.rowCount || 0,
          billsUpdated: billsResult.rowCount || 0,
          feedPosts: feedResult.rowCount || 0,
          chatMessages: chatsResult.rowCount || 0,
          partiesUpdated: partyLeaderResult.rowCount || 0,
          userDeleted: userDeleteResult.rowCount || 0,
        },
      };

      console.log("User purge successful:", deletionSummary);

      return NextResponse.json({
        success: true,
        message: `User ${user.username} and all associated data have been purged`,
        summary: deletionSummary,
      });
    } catch (error) {
      // Rollback transaction on error
      await query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Error purging user:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to purge user",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
