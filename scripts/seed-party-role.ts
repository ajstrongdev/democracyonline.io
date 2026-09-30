import { loadEnvFile } from "node:process";
import pg from "pg";

loadEnvFile();

const role = process.argv[2];
const email = (process.env.PARTY_TEST_EMAIL ?? "ajstrongdev@pm.me")
  .trim()
  .toLowerCase();
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const database = new URL(url);
if (
  process.env.NODE_ENV === "production" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)
) {
  throw new Error(
    "Party role seeds only run against a local development database",
  );
}
if (
  !(["leader", "chief-whip", "social-media-officer"] as Array<string>).includes(
    role,
  )
) {
  throw new Error(
    "Usage: pnpm db:seed:party-leader | db:seed:chief-whip | db:seed:social-media-officer",
  );
}
const client = new pg.Client({ connectionString: url });
let connected = false;
let inTransaction = false;

try {
  await client.connect();
  connected = true;
  await client.query("BEGIN");
  inTransaction = true;
  const playerResult = await client.query<{
    id: number;
    party_id: number | null;
    username: string;
  }>(
    "SELECT id, party_id, username FROM users WHERE lower(email) = $1 AND is_active = true FOR UPDATE",
    [email],
  );
  const player = playerResult.rows[0];
  if (!playerResult.rows.length || !player.party_id)
    throw new Error(
      `${email} must be an active member of a party before switching roles`,
    );

  const partyResult = await client.query<{
    id: number;
    name: string;
    leader_id: number | null;
    chief_whip_id: number | null;
    social_media_officer_id: number | null;
  }>(
    "SELECT id, name, leader_id, chief_whip_id, social_media_officer_id FROM parties WHERE id = $1 AND archived_at IS NULL FOR UPDATE",
    [player.party_id],
  );
  const party = partyResult.rows[0];
  if (!partyResult.rows.length) throw new Error("Player's party is not active");

  const otherParty = await client.query(
    "SELECT name FROM parties WHERE id <> $1 AND (leader_id = $2 OR chief_whip_id = $2 OR social_media_officer_id = $2) LIMIT 1",
    [party.id, player.id],
  );
  if (otherParty.rowCount)
    throw new Error("Player holds a post in another party; resolve that first");

  if (role === "leader") {
    await client.query(
      "UPDATE parties SET leader_id = $1, chief_whip_id = CASE WHEN chief_whip_id = $1 THEN NULL ELSE chief_whip_id END, social_media_officer_id = CASE WHEN social_media_officer_id = $1 THEN NULL ELSE social_media_officer_id END WHERE id = $2",
      [player.id, party.id],
    );
  } else {
    if (party.leader_id === player.id) {
      const successor = await client.query<{ id: number; username: string }>(
        "SELECT id, username FROM users WHERE party_id = $1 AND id <> $2 AND is_active = true AND id IS DISTINCT FROM $3 AND id IS DISTINCT FROM $4 ORDER BY id LIMIT 1",
        [
          party.id,
          player.id,
          party.chief_whip_id,
          party.social_media_officer_id,
        ],
      );
      if (!successor.rows.length)
        throw new Error(
          "Another active member without an officer post is needed to succeed the leader",
        );
      await client.query("UPDATE parties SET leader_id = $1 WHERE id = $2", [
        successor.rows[0].id,
        party.id,
      ]);
      console.log(`Party Leader transferred to ${successor.rows[0].username}`);
    }
    const column =
      role === "chief-whip" ? "chief_whip_id" : "social_media_officer_id";
    const otherColumn =
      role === "chief-whip" ? "social_media_officer_id" : "chief_whip_id";
    await client.query(
      `UPDATE parties SET ${column} = $1, ${otherColumn} = CASE WHEN ${otherColumn} = $1 THEN NULL ELSE ${otherColumn} END WHERE id = $2`,
      [player.id, party.id],
    );
  }

  await client.query("COMMIT");
  inTransaction = false;
  console.log(
    `${player.username} is now ${role} of ${party.name}. No Firebase user was changed.`,
  );
} catch (error) {
  if (inTransaction) await client.query("ROLLBACK");
  throw error;
} finally {
  if (connected) await client.end();
}
