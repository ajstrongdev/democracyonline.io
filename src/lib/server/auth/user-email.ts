import { eq, sql } from "drizzle-orm";
import { users } from "@/db/schema";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function userEmailEquals(email: string) {
  return eq(sql`lower(${users.email})`, normalizeEmail(email));
}
