import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bills, candidates, elections, parties, users } from "@/db/schema";

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

            case "candidates": {
              const election = url.searchParams.get("election");

              if (election) {
                // Validate election parameter
                if (!["President", "Senate", "House"].includes(election)) {
                  return new Response(
                    JSON.stringify({
                      error: "Invalid election type",
                      validElections: ["President", "Senate", "House"],
                    }),
                    {
                      status: 400,
                      headers: { "Content-Type": "application/json" },
                    },
                  );
                }

                // Get candidates for specific election
                const electionCandidates = await db
                  .select({
                    id: candidates.id,
                    userId: candidates.userId,
                    username: users.username,
                    election: candidates.election,
                    votes: candidates.votes,
                    donations: candidates.donations,
                    votesPerHour: candidates.votesPerHour,
                    donationsPerHour: candidates.donationsPerHour,
                    partyId: users.partyId,
                    partyName: parties.name,
                    partyColor: parties.color,
                  })
                  .from(candidates)
                  .leftJoin(users, eq(candidates.userId, users.id))
                  .leftJoin(parties, eq(users.partyId, parties.id))
                  .where(eq(candidates.election, election))
                  .orderBy(desc(candidates.votes));

                return new Response(JSON.stringify(electionCandidates), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                });
              } else {
                // Get all candidates across all elections
                const allCandidates = await db
                  .select({
                    id: candidates.id,
                    userId: candidates.userId,
                    username: users.username,
                    election: candidates.election,
                    votes: candidates.votes,
                    donations: candidates.donations,
                    votesPerHour: candidates.votesPerHour,
                    donationsPerHour: candidates.donationsPerHour,
                    partyId: users.partyId,
                    partyName: parties.name,
                    partyColor: parties.color,
                  })
                  .from(candidates)
                  .leftJoin(users, eq(candidates.userId, users.id))
                  .leftJoin(parties, eq(users.partyId, parties.id))
                  .orderBy(desc(candidates.votes));

                return new Response(JSON.stringify(allCandidates), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                });
              }
            }

            case "game-state": {
              const electionStates = await db.select().from(elections);

              // Fetch candidates for elections in Voting or Concluded status
              const enrichedStates = await Promise.all(
                electionStates.map(async (election) => {
                  if (
                    election.status === "Voting" ||
                    election.status === "Concluded"
                  ) {
                    // Get candidates for this election with user and party info
                    const electionCandidates = await db
                      .select({
                        id: candidates.id,
                        userId: candidates.userId,
                        username: users.username,
                        election: candidates.election,
                        votes: candidates.votes,
                        donations: candidates.donations,
                        partyId: users.partyId,
                        partyName: parties.name,
                        partyColor: parties.color,
                      })
                      .from(candidates)
                      .leftJoin(users, eq(candidates.userId, users.id))
                      .leftJoin(parties, eq(users.partyId, parties.id))
                      .where(eq(candidates.election, election.election))
                      .orderBy(desc(candidates.votes));

                    return {
                      ...election,
                      candidates: electionCandidates,
                    };
                  }
                  return election;
                }),
              );

              return new Response(JSON.stringify(enrichedStates), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }

            default: {
              return new Response(
                JSON.stringify({
                  error: "Invalid endpoint",
                  available: [
                    "users",
                    "parties",
                    "bills",
                    "candidates",
                    "game-state",
                  ],
                  usage: {
                    users:
                      "/api/bot?endpoint=users or /api/bot?endpoint=users&id=1",
                    parties:
                      "/api/bot?endpoint=parties or /api/bot?endpoint=parties&id=1",
                    bills:
                      "/api/bot?endpoint=bills or /api/bot?endpoint=bills&stage=House or /api/bot?endpoint=bills&stage=House&status=Voting",
                    candidates:
                      "/api/bot?endpoint=candidates or /api/bot?endpoint=candidates&election=President",
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
