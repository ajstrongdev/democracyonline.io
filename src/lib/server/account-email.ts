import { eq, sql } from "drizzle-orm";
import { accounts } from "@/db/schema";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// Case-insensitive match since auth emails aren't normalized.
export function accountEmailEquals(email: string) {
  return eq(sql`lower(${accounts.email})`, normalizeEmail(email));
}
