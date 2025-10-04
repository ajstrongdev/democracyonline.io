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

async function seedData() {
  try {
    const testUser1 = await query(
      "INSERT INTO users (email, username, role) VALUES ($1, $2, $3) RETURNING *",
      ["test@test.com", "maggietime", "Representative"]
    );
    const testUser2 = await query(
      "INSERT INTO users (email, username, role) VALUES ($1, $2, $3) RETURNING *",
      ["test2@test.com", "maggietime2", "Representative"]
    );
    const testUser3 = await query(
      "INSERT INTO users (email, username, role) VALUES ($1, $2, $3) RETURNING *",
      ["test3@test.com", "maggietime3", "Representative"]
    );
    const testUser4 = await query(
      "INSERT INTO users (email, username, role) VALUES ($1, $2, $3) RETURNING *",
      ["test4@test.com", "maggietime4", "Representative"]
    );
    const testUser5 = await query(
      "INSERT INTO users (email, username, role) VALUES ($1, $2, $3) RETURNING *",
      ["test5@test.com", "maggietime5", "Representative"]
    );
    const testUser6 = await query(
      "INSERT INTO users (email, username, role) VALUES ($1, $2, $3) RETURNING *",
      ["test6@test.com", "maggietime6", "Representative"]
    );
    const bill = await query(
      "INSERT INTO bills (status, stage, title, creator_id, content) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [
        "Voting",
        "House",
        "Dummy Bill Title",
        testUser1.rows[0].id,
        "This is a dummy bill content.",
      ]
    );
    const queued_bill = await query(
      "INSERT INTO bills (status, stage, title, creator_id, content) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [
        "Queued",
        "House",
        "Queued Bill Title",
        testUser2.rows[0].id,
        "This is a queued bill content.",
      ]
    );
    const house_bills_vote = await query(
      "INSERT INTO bill_votes_house (bill_id, voter_id, vote_yes) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12) RETURNING *",
      [
        bill.rows[0].id,
        testUser3.rows[0].id,
        true,
        bill.rows[0].id,
        testUser4.rows[0].id,
        true,
        bill.rows[0].id,
        testUser5.rows[0].id,
        false,
        bill.rows[0].id,
        testUser6.rows[0].id,
        false,
      ]
    );
    console.log(
      "Test users created:",
      testUser1.rows[0],
      testUser2.rows[0] +
        testUser3.rows[0] +
        testUser4.rows[0] +
        testUser5.rows[0]
    );
    console.log("Dummy bill created:", bill.rows[0], queued_bill.rows[0]);
    console.log("Dummy house votes created:", house_bills_vote.rows);
  } catch (error) {
    console.error("Error during seeding:", error);
    throw error;
  }
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
      CREATE TABLE IF NOT EXISTS bill_votes_presidential (
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    } catch (error: any) {
      // do nothing
    }
    await seedData();
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
