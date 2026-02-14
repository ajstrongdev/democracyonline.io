import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAuthMiddleware } from "@/middleware";

export const getBankBalance = createServerFn()
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    if (!context.user?.email) {
      throw new Error("Unauthorized access to bank balance");
    }

    const [requestedUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, context.user.email))
      .limit(1);

    if (!requestedUser) {
      throw new Error("User not found");
    }

    return { balance: requestedUser.money || 0 };
  });
