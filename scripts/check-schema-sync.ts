import { loadEnvFile } from "node:process";
import pg from "pg";

loadEnvFile();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL! });

async function main() {
  await client.connect();
  try {
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
    );
    const dbTables = new Set(tables.rows.map((r) => r.table_name));
    
    // Extract pgTable names from schema.ts by grepping
    const schemaContent = await import("node:fs").then((fs) =>
      fs.default.readFileSync("src/db/schema.ts", "utf-8"),
    );
    
    // Find all table definitions
    const tableNames = new Set<string>();
    for (const match of schemaContent.matchAll(/pgTable\(\s*"([^"]+)"/g)) {
      tableNames.add(match[1]);
    }
    
    console.log("=== Tables in schema but NOT in DB ===");
    for (const name of [...tableNames].sort()) {
      if (!dbTables.has(name)) {
        console.log(`  MISSING: ${name}`);
      }
    }
    
    console.log("\n=== Tables in DB but NOT in schema ===");
    for (const name of [...dbTables].sort()) {
      if (!tableNames.has(name)) {
        console.log(`  EXTRA: ${name}`);
      }
    }

    // Now check columns for key tables
    const keyTables = [
      "users", "parties", "coalitions", "feed", "elections",
      "candidates", "bills", "coalition_members", "coalition_proposals",
      "coalition_votes", "organization_lifecycle_events", "player_invitations",
      "player_reports", "moderation_flags", "moderation_audit_log",
      "archived_parties", "coalition_former_members"
    ];

    for (const tableName of keyTables) {
      if (!dbTables.has(tableName)) continue;
      const cols = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position",
        [tableName],
      );
      const dbCols = new Set(cols.rows.map((r) => r.column_name));
      
      // Extract column names from schema for this table
      const colRegex = new RegExp(
        `pgTable\\(\\s*"${tableName}"[\\s\\S]*?\\)`,
        "m",
      );
      const tableMatch = schemaContent.match(colRegex);
      if (!tableMatch) continue;
      
      const tableBlock = tableMatch[0];
      const schemaColNames = new Set<string>();
      // Match column definitions - look for the first arg to the column function
      for (const m of tableBlock.matchAll(/(?:serial|integer|varchar|text|boolean|timestamp|jsonb)\("([^"]+)"/g)) {
        schemaColNames.add(m[1]);
      }
      
      const missingInDb = [...schemaColNames].filter((c) => !dbCols.has(c));
      if (missingInDb.length) {
        console.log(`\n${tableName}: COLUMNS IN SCHEMA BUT NOT IN DB: ${missingInDb.join(", ")}`);
      }
    }
  } finally {
    await client.end();
  }
}

main();
