import { loadEnvFile } from "node:process";
import pg from "pg";

loadEnvFile();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL! });

async function main() {
  await client.connect();
  try {
    console.log("=== TABLES ===");
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
    );
    tables.rows.forEach((r) => console.log(r.table_name));

    console.log("\n=== FEED COLUMNS ===");
    const feedCols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='feed' ORDER BY ordinal_position",
    );
    feedCols.rows.forEach((r) => console.log(r.column_name));

    console.log("\n=== USERS COLUMNS ===");
    const userCols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position",
    );
    userCols.rows.forEach((r) => console.log(r.column_name));
  } finally {
    await client.end();
  }
}

main();
