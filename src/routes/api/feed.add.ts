import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { feed } from "@/db/schema";

export const Route = createFileRoute("/api/feed/add")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Parse the request body
          const body = await request.json();
          const { userId, content } = body;

          // Validate required fields
          if (!userId || !content) {
            return new Response(
              JSON.stringify({
                error:
                  "Missing required fields: userId and content are required",
              }),
              {
                status: 400,
                headers: {
                  "Content-Type": "application/json",
                },
              },
            );
          }

          // Validate types
          if (typeof userId !== "number" || typeof content !== "string") {
            return new Response(
              JSON.stringify({
                error:
                  "Invalid field types: userId must be a number and content must be a string",
              }),
              {
                status: 400,
                headers: {
                  "Content-Type": "application/json",
                },
              },
            );
          }

          // Insert the feed item into the database
          const [newFeedItem] = await db
            .insert(feed)
            .values({
              userId,
              content,
            })
            .returning();

          return new Response(JSON.stringify(newFeedItem), {
            status: 201,
            headers: {
              "Content-Type": "application/json",
            },
          });
        } catch (error) {
          console.error("Error adding feed item:", error);
          return new Response(
            JSON.stringify({ error: "Failed to add feed item" }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
              },
            },
          );
        }
      },
    },
  },
});
