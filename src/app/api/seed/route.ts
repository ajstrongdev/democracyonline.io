import { NextResponse } from "next/server";
import { query } from "@/lib/db";

async function listTables(message: string): Promise<void> {
  console.log(message);
  const res = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log(res);
  console.log(res.rows.map((r) => r.table_name));
}

async function seed() {
  await listTables("Tables before seeding:");
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS parties (
        id SERIAL PRIMARY KEY,
        leader_id INT,
        name VARCHAR(255) UNIQUE NOT NULL,
        color VARCHAR(7) NOT NULL,
        bio TEXT,
        manifesto_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'Representative',
        party_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_party
          FOREIGN KEY (party_id)
          REFERENCES parties(id)
          ON DELETE SET NULL
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        standing_for VARCHAR(255) NOT NULL
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS presidential_election (
        id SERIAL PRIMARY KEY,
        voter_id INTEGER REFERENCES users(id),
        candidate_id INTEGER REFERENCES users(id),
        points_won INTEGER NOT NULL
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS senate_election (
        id SERIAL PRIMARY KEY,
        voter_id INTEGER REFERENCES users(id),
        candidate_id INTEGER REFERENCES users(id),
        points_won INTEGER NOT NULL
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS bills (
        id SERIAL PRIMARY KEY,
        status VARCHAR(50) NOT NULL DEFAULT 'Queued',
        stage VARCHAR(50) NOT NULL DEFAULT 'House',
        title VARCHAR(255) NOT NULL,
        creator_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS bill_votes_house (
        id SERIAL PRIMARY KEY,
        bill_id INTEGER REFERENCES bills(id),
        voter_id INTEGER REFERENCES users(id),
        vote_yes BOOLEAN NOT NULL
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS bill_votes_senate (
        id SERIAL PRIMARY KEY,
        bill_id INTEGER REFERENCES bills(id),
        voter_id INTEGER REFERENCES users(id),
        vote_yes BOOLEAN NOT NULL
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS bill_votes_president (
        id SERIAL PRIMARY KEY,
        bill_id INTEGER REFERENCES bills(id),
        voter_id INTEGER REFERENCES users(id),
        vote_yes BOOLEAN NOT NULL
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS feed (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await listTables("Tables after seeding:");

    // Add foreign key constraint from parties.leader_id to users.id if not exists
    try {
      await query(`
        ALTER TABLE parties
        ADD CONSTRAINT fk_party_leader
        FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL;
      `);
    } catch (error: any) {
      // do nothing
    }

    // Create 2 test users
    try {
      const testUser1 = await query(
        "INSERT INTO users (email, username, role) VALUES ($1, $2, $3) RETURNING *",
        ["test@test.com", "maggietime", "Representative"]
      );
      const testUser2 = await query(
        "INSERT INTO users (email, username, role) VALUES ($1, $2, $3) RETURNING *",
        ["test2@test.com", "maggietime2", "Representative"]
      );
      console.log("Test users created:", testUser1.rows[0], testUser2.rows[0]);
    } catch (error) {
      console.error("Error during seeding:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error during seeding:", error);
    throw error;
  }
}

export async function GET() {
  try {
    await seed();
    return NextResponse.json({ message: "Database seeded successfully" });
  } catch (error) {
    console.error("Failed to seed database", error);
    return NextResponse.json(
      { error: "Failed to seed database" },
      { status: 500 }
    );
  }
}
