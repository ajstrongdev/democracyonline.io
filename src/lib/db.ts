import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.CONNECTION_STRING,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res;
}

export default pool;
