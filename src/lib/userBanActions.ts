import { query } from "./db";

/**
 * Handle all database operations when a user is banned/disabled
 * @param uid - Firebase user ID
 * @param userEmail - User's email address
 */
export async function handleUserBan(uid: string, userEmail: string) {
  try {
    // Get the user from database
    const userResult = await query("SELECT * FROM users WHERE email = $1", [
      userEmail,
    ]);

    if (userResult.rows.length === 0) {
      console.log("User not found in database:", userEmail);
      return;
    }

    const user = userResult.rows[0];
    const userId = user.id;
    const partyId = user.party_id;

    // 1. Update user: set username to "Banned User" and remove party_id
    await query(
      "UPDATE users SET username = $1, party_id = NULL WHERE id = $2",
      ["Banned User", userId]
    );

    // 2. Delete all bills created by this user
    await query("DELETE FROM bills WHERE creator_id = $1", [userId]);

    // 3. Update all chat messages from this user to "Deleted message." and username to "Banned User"
    await query(
      "UPDATE chats SET message = $1, username = $2 WHERE user_id = $3",
      ["Deleted message.", "Banned User", userId]
    );

    // 4. Delete all feed entries created by this user
    await query("DELETE FROM feed WHERE user_id = $1", [userId]);

    // 5. If user was party leader, remove leadership and check if party should be deleted
    if (partyId) {
      const partyResult = await query(
        "SELECT * FROM parties WHERE id = $1 AND leader_id = $2",
        [partyId, userId]
      );

      if (partyResult.rows.length > 0) {
        // User was the leader, remove leadership
        await query("UPDATE parties SET leader_id = NULL WHERE id = $1", [
          partyId,
        ]);

        // Check if party should be deleted (if it has no other members)
        await checkAndDeleteParty(partyId);
      }
    }

    console.log(`User ${userEmail} (ID: ${userId}) banned successfully`);
  } catch (error) {
    console.error("Error handling user ban:", error);
    throw error;
  }
}

/**
 * Check if a party has no members and delete it if empty
 * @param partyId - Party ID to check
 */
export async function checkAndDeleteParty(partyId: number) {
  try {
    // Count members in the party
    const membersResult = await query(
      "SELECT COUNT(*) as count FROM users WHERE party_id = $1",
      [partyId]
    );

    const memberCount = parseInt(membersResult.rows[0]?.count || "0");

    if (memberCount === 0) {
      // No members left, delete the party
      console.log(`Party ${partyId} has no members, deleting...`);

      // Delete party stances first (foreign key constraint)
      await query("DELETE FROM party_stances WHERE party_id = $1", [partyId]);

      // Delete the party
      await query("DELETE FROM parties WHERE id = $1", [partyId]);

      console.log(`Party ${partyId} deleted successfully`);
    }
  } catch (error) {
    console.error("Error checking/deleting party:", error);
    throw error;
  }
}

/**
 * Delete a party and set all members' party_id to null
 * @param partyId - Party ID to delete
 */
export async function deleteParty(partyId: number) {
  try {
    // 1. Set all users' party_id to null
    await query("UPDATE users SET party_id = NULL WHERE party_id = $1", [
      partyId,
    ]);

    // 2. Delete party stances
    await query("DELETE FROM party_stances WHERE party_id = $1", [partyId]);

    // 3. Delete the party
    await query("DELETE FROM parties WHERE id = $1", [partyId]);

    console.log(`Party ${partyId} deleted successfully`);
  } catch (error) {
    console.error("Error deleting party:", error);
    throw error;
  }
}
