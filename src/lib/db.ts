import { Pool } from "pg";

// Log connection string presence (not the actual value for security)
if (!process.env.CONNECTION_STRING) {
  console.error(
    "DATABASE ERROR: CONNECTION_STRING environment variable is not set"
  );
}

const pool = new Pool({
  connectionString: process.env.CONNECTION_STRING,
});

// Handle pool errors to prevent unhandled promise rejections
pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query(text: string, params?: any[]) {
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (error) {
    console.error("Database query error:", {
      query: text,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

export default pool;
