import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { users, parties, elections, bills } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";

export const Route = createFileRoute("/api/bot")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const endpoint = url.searchParams.get("endpoint");
        const id = url.searchParams.get("id");

        try {
          switch (endpoint) {
            case "users": {
              if (id) {
                const userId = parseInt(id);
                if (isNaN(userId)) {
                  return new Response(
                    JSON.stringify({ error: "Invalid user ID" }),
                    {
                      status: 400,
                      headers: { "Content-Type": "application/json" },
                    },
                  );
                }

                const userResults = await db
                  .select({
                    id: users.id,
                    username: users.username,
                    bio: users.bio,
                    role: users.role,
                    partyId: users.partyId,
                    politicalLeaning: users.politicalLeaning,
                    isActive: users.isActive,
                    lastActivity: users.lastActivity,
                    partyName: parties.name,
                    partyColor: parties.color,
                  })
                  .from(users)
                  .leftJoin(parties, eq(users.partyId, parties.id))
                  .where(eq(users.id, userId))
                  .limit(1);

                if (userResults.length === 0) {
                  return new Response(
                    JSON.stringify({ error: "User not found" }),
                    {
                      status: 404,
                      headers: { "Content-Type": "application/json" },
                    },
                  );
                }

                return new Response(JSON.stringify(userResults[0]), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                });
              } else {
                const allUsers = await db
                  .select({
                    id: users.id,
                    username: users.username,
                    bio: users.bio,
                    role: users.role,
                    partyId: users.partyId,
                    politicalLeaning: users.politicalLeaning,
                    isActive: users.isActive,
                    lastActivity: users.lastActivity,
                    partyName: parties.name,
                    partyColor: parties.color,
                  })
                  .from(users)
                  .leftJoin(parties, eq(users.partyId, parties.id));

                return new Response(JSON.stringify(allUsers), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                });
              }
            }

            case "parties": {
              if (id) {
                const partyId = parseInt(id);
                if (isNaN(partyId)) {
                  return new Response(
                    JSON.stringify({ error: "Invalid party ID" }),
                    {
                      status: 400,
                      headers: { "Content-Type": "application/json" },
                    },
                  );
                }

                const partyResults = await db
                  .select({
                    id: parties.id,
                    name: parties.name,
                    color: parties.color,
                    bio: parties.bio,
                    leaderId: parties.leaderId,
                    politicalLeaning: parties.politicalLeaning,
                    leaning: parties.leaning,
                    logo: parties.logo,
                    discord: parties.discord,
                    memberCount:
                      sql<number>`(SELECT COUNT(*)::int FROM ${users} WHERE ${users.partyId} = ${parties.id})`.as(
                        "member_count",
                      ),
                  })
                  .from(parties)
                  .where(eq(parties.id, partyId))
                  .limit(1);

                if (partyResults.length === 0) {
                  return new Response(
                    JSON.stringify({ error: "Party not found" }),
                    {
                      status: 404,
                      headers: { "Content-Type": "application/json" },
                    },
                  );
                }

                const members = await db
                  .select({
                    id: users.id,
                    username: users.username,
                    role: users.role,
                  })
                  .from(users)
                  .where(eq(users.partyId, partyId));

                return new Response(
                  JSON.stringify({
                    ...partyResults[0],
                    members,
                  }),
                  {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                  },
                );
              } else {
                const allParties = await db
                  .select({
                    id: parties.id,
                    name: parties.name,
                    color: parties.color,
                    bio: parties.bio,
                    leaderId: parties.leaderId,
                    politicalLeaning: parties.politicalLeaning,
                    leaning: parties.leaning,
                    logo: parties.logo,
                    discord: parties.discord,
                    memberCount:
                      sql<number>`(SELECT COUNT(*)::int FROM ${users} WHERE ${users.partyId} = ${parties.id})`.as(
                        "member_count",
                      ),
                  })
                  .from(parties);

                return new Response(JSON.stringify(allParties), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                });
              }
            }

            case "bills": {
              const stage = url.searchParams.get("stage");
              const status = url.searchParams.get("status");

              // Validate stage parameter if provided
              if (stage && !["House", "Senate", "Presidency"].includes(stage)) {
                return new Response(
                  JSON.stringify({
                    error: "Invalid stage",
                    validStages: ["House", "Senate", "Presidency"],
                  }),
                  {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                  },
                );
              }

              if (stage || status) {
                // Build where conditions
                const conditions = [];
                if (stage) {
                  conditions.push(eq(bills.stage, stage));
                }
                if (status) {
                  conditions.push(eq(bills.status, status));
                }

                const filteredBills = await db
                  .select({
                    id: bills.id,
                    status: bills.status,
                    stage: bills.stage,
                    title: bills.title,
                    creatorId: bills.creatorId,
                    content: bills.content,
                    createdAt: bills.createdAt,
                    pool: bills.pool,
                    creatorUsername: users.username,
                  })
                  .from(bills)
                  .leftJoin(users, eq(bills.creatorId, users.id))
                  .where(
                    conditions.length > 1 ? and(...conditions) : conditions[0],
                  );

                return new Response(JSON.stringify(filteredBills), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                });
              } else {
                // Return all bills grouped by stage
                const allBills = await db
                  .select({
                    id: bills.id,
                    status: bills.status,
                    stage: bills.stage,
                    title: bills.title,
                    creatorId: bills.creatorId,
                    content: bills.content,
                    createdAt: bills.createdAt,
                    pool: bills.pool,
                    creatorUsername: users.username,
                  })
                  .from(bills)
                  .leftJoin(users, eq(bills.creatorId, users.id));

                // Group by stage
                const grouped = {
                  House: allBills.filter((b) => b.stage === "House"),
                  Senate: allBills.filter((b) => b.stage === "Senate"),
                  Presidency: allBills.filter((b) => b.stage === "Presidency"),
                };

                return new Response(JSON.stringify(grouped), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                });
              }
            }

            case "game-state": {
              const electionStates = await db.select().from(elections);

              return new Response(JSON.stringify(electionStates), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }

            default: {
              return new Response(
                JSON.stringify({
                  error: "Invalid endpoint",
                  available: ["users", "parties", "bills", "game-state"],
                  usage: {
                    users:
                      "/api/bot?endpoint=users or /api/bot?endpoint=users&id=1",
                    parties:
                      "/api/bot?endpoint=parties or /api/bot?endpoint=parties&id=1",
                    bills:
                      "/api/bot?endpoint=bills or /api/bot?endpoint=bills&stage=House or /api/bot?endpoint=bills&stage=House&status=Voting",
                    gameState: "/api/bot?endpoint=game-state",
                  },
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }
          }
        } catch (error) {
          console.error("Bot API error:", error);
          return new Response(
            JSON.stringify({
              error: "Internal server error",
              message: error instanceof Error ? error.message : "Unknown error",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },
  },
});
