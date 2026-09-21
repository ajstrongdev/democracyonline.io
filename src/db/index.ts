import * as schema from "@/db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

async function createDatabase(): Promise<NodePgDatabase<typeof schema>> {
  const [{ drizzle }, { Pool }, { env }] = await Promise.all([
    import("drizzle-orm/node-postgres"),
    import("pg"),
    import("@/env.ts"),
  ]);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  return drizzle(pool, { schema });
}

export const db =
  typeof window === "undefined"
    ? await createDatabase()
    : (undefined as never as NodePgDatabase<typeof schema>);
