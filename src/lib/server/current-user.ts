import { db } from "@/db";
import { users } from "@/db/schema";
import { userEmailEquals } from "@/lib/server/user-email";

interface FirebaseIdentity {
  uid: string;
  email?: string;
}

export async function getCurrentDatabaseUser(identity: FirebaseIdentity) {
  if (!identity.email) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(userEmailEquals(identity.email))
    .limit(1);
  return user ?? null;
}
