import { query } from "@/lib/db";

export async function getCurrentUser(email: string | undefined) {
  if (!email) return null;

  const result = await query(
    "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
    [email]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}
