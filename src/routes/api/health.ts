import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await db.execute(sql`select 1`);
          return Response.json(
            { status: "ok" },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          console.error("[health] Database is unavailable", error);
          return Response.json(
            { status: "unavailable" },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
