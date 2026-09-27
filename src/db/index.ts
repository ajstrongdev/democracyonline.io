import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";

async function createDatabase(): Promise<NodePgDatabase<typeof schema>> {
  const [{ drizzle }, { Pool }, { env }] = await Promise.all([
    import("drizzle-orm/node-postgres"),
    import("pg"),
    import("@/env.ts"),
  ]);
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: 10,
  });
  return drizzle(pool, { schema });
}

export const db =
  typeof window === "undefined"
    ? await createDatabase()
    : (undefined as never as NodePgDatabase<typeof schema>);
