import { createFileRoute } from "@tanstack/react-router";
import { OAuth2Client } from "google-auth-library";
import { and, desc, eq, inArray, sql, gt } from "drizzle-orm";
import { db } from "@/db";
import {
  candidateSnapshots,
  candidates,
  candidatePurchases,
  elections,
  feed,
  items,
  parties,
  partyStances,
  users,
  partyTransactionHistory,
  transactionHistory,
} from "@/db/schema";
import { env } from "@/env";

const oAuth2Client = new OAuth2Client();

async function seedCampaignItems() {
  // Check if items already exist
  const existingItems = await db.select().from(items).limit(1);

  if (existingItems.length > 0) {
    // Items already seeded, do nothing
    return;
  }

  // Seed items - mix of vote and donation generators
  const seedItems = [
    // Donation generators
    {
      name: "Lemonade Stand",
      description:
        "A humble beginning. Sell lemonade to raise funds for your campaign.",
      target: "Donations",
      increaseAmount: 1,
      baseCost: 10,
      costMultiplier: 15,
    },
    {
      name: "Bake Sale",
      description: "Homemade cookies and cakes bring in the donations.",
      target: "Donations",
      increaseAmount: 3,
      baseCost: 50,
      costMultiplier: 18,
    },
    {
      name: "Merchandise Booth",
      description: "Sell campaign t-shirts, hats, and bumper stickers.",
      target: "Donations",
      increaseAmount: 8,
      baseCost: 200,
      costMultiplier: 20,
    },
    {
      name: "Online Crowdfunding",
      description: "Set up a crowdfunding page to reach donors nationwide.",
      target: "Donations",
      increaseAmount: 20,
      baseCost: 500,
      costMultiplier: 22,
    },
    {
      name: "Fundraising Dinner",
      description: "Host exclusive dinners for wealthy donors.",
      target: "Donations",
      increaseAmount: 50,
      baseCost: 1500,
      costMultiplier: 25,
    },
    {
      name: "Corporate Sponsor",
      description: "Partner with businesses who support your platform.",
      target: "Donations",
      increaseAmount: 150,
      baseCost: 5000,
      costMultiplier: 28,
    },
    {
      name: "Super PAC Connection",
      description:
        "Connect with political action committees for major fundraising.",
      target: "Donations",
      increaseAmount: 400,
      baseCost: 15000,
      costMultiplier: 30,
    },
    {
      name: "Billionaire Endorsement",
      description: "Gain the backing of a wealthy tycoon.",
      target: "Donations",
      increaseAmount: 1000,
      baseCost: 50000,
      costMultiplier: 32,
    },
    // Vote generators
    {
      name: "Campaign Flyers",
      description: "Hand out flyers in your neighborhood to spread the word.",
      target: "Votes",
      increaseAmount: 1,
      baseCost: 15,
      costMultiplier: 15,
    },
    {
      name: "Door-to-Door Canvassing",
      description: "Hire volunteers to knock on doors and talk to voters.",
      target: "Votes",
      increaseAmount: 3,
      baseCost: 75,
      costMultiplier: 18,
    },
    {
      name: "Town Hall Meeting",
      description: "Host public meetings to engage with citizens.",
      target: "Votes",
      increaseAmount: 8,
      baseCost: 250,
      costMultiplier: 20,
    },
    {
      name: "Local Radio Ads",
      description: "Run advertisements on local radio stations.",
      target: "Votes",
      increaseAmount: 20,
      baseCost: 600,
      costMultiplier: 22,
    },
    {
      name: "Newspaper Endorsement",
      description: "Secure endorsements from local newspapers.",
      target: "Votes",
      increaseAmount: 50,
      baseCost: 1800,
      costMultiplier: 25,
    },
    {
      name: "TV Commercial",
      description: "Air campaign commercials on local television.",
      target: "Votes",
      increaseAmount: 150,
      baseCost: 6000,
      costMultiplier: 28,
    },
    {
      name: "Celebrity Endorsement",
      description: "Get a famous celebrity to publicly support your campaign.",
      target: "Votes",
      increaseAmount: 400,
      baseCost: 18000,
      costMultiplier: 30,
    },
    {
      name: "Viral Social Media Campaign",
      description: "Launch a social media blitz that goes viral nationwide.",
      target: "Votes",
      increaseAmount: 1000,
      baseCost: 60000,
      costMultiplier: 32,
    },
    // High-tier items
    {
      name: "Political Rally",
      description:
        "Organize massive rallies that energize your base and attract media coverage.",
      target: "Votes",
      increaseAmount: 2500,
      baseCost: 150000,
      costMultiplier: 35,
    },
    {
      name: "Debate Prep Team",
      description:
        "Hire expert coaches to dominate debates and win over undecided voters.",
      target: "Votes",
      increaseAmount: 5000,
      baseCost: 400000,
      costMultiplier: 38,
    },
    {
      name: "National Media Tour",
      description:
        "Appear on major news networks and talk shows across the country.",
      target: "Votes",
      increaseAmount: 10000,
      baseCost: 1000000,
      costMultiplier: 40,
    },
    {
      name: "International Charity Event",
      description:
        "Host a high-profile charity gala that attracts worldwide attention.",
      target: "Donations",
      increaseAmount: 2500,
      baseCost: 200000,
      costMultiplier: 35,
    },
    {
      name: "Hedge Fund Alliance",
      description: "Form partnerships with major financial institutions.",
      target: "Donations",
      increaseAmount: 5000,
      baseCost: 500000,
      costMultiplier: 38,
    },
    {
      name: "Tech Industry Summit",
      description:
        "Court Silicon Valley billionaires with promises of innovation.",
      target: "Donations",
      increaseAmount: 10000,
      baseCost: 1200000,
      costMultiplier: 40,
    },
  ];

  await db.insert(items).values(seedItems);
}

async function updateSenateSeats() {
  const candidatesCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(candidates)
    .where(eq(candidates.election, "Senate"));

  const candidateCount = candidatesCount[0]?.count || 0;

  const halfCandidates = Math.ceil(candidateCount * 0.5);
  const seats = Math.max(3, halfCandidates);

  await db
    .update(elections)
    .set({ seats })
    .where(eq(elections.election, "Senate"));
}

export const Route = createFileRoute("/api/game-advance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        console.log("[game-advance] Handler started");
        // Skip authentication in development mode
        if (!env.IS_DEV) {
          const authHeader = request.headers.get("authorization");

          if (!authHeader || !authHeader.startsWith("Bearer ")) {
            console.error("Missing or invalid Authorization header");
            return new Response(
              JSON.stringify({ success: false, error: "Unauthorized" }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }
          const token = authHeader.substring(7);

          try {
            const ticket = await oAuth2Client.verifyIdToken({
              idToken: token,
              audience: env.SITE_URL || "https://democracyonline.io",
            });

            const payload = ticket.getPayload();

            const expectedEmailPattern =
              /-scheduler@.*\.iam\.gserviceaccount\.com$/;

            if (!payload?.email || !expectedEmailPattern.test(payload.email)) {
              console.error("Invalid service account:", payload?.email);
              return new Response(
                JSON.stringify({
                  success: false,
                  error: "Unauthorized - Invalid service account",
                }),
                {
                  status: 401,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }

            console.log("Authenticated request from:", payload.email);
          } catch (error) {
            console.error("Token validation failed:", error);
            return new Response(
              JSON.stringify({
                success: false,
                error: "Unauthorized - Invalid token",
              }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }
        }

        console.log("[game-advance] Starting presidential election processing");
        try {
          const presElection = await db
            .select()
            .from(elections)
            .where(eq(elections.election, "President"));

          const electionStatus = presElection[0]?.status;
          const daysLeft = presElection[0]?.daysLeft;
          console.log(
            `[game-advance] Presidential status: ${electionStatus}, days left: ${daysLeft}`,
          );

          if (electionStatus === "Candidate") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(eq(elections.election, "President"));
            } else {
              await seedCampaignItems();
              await db
                .update(elections)
                .set({ status: "Voting", daysLeft: 10 })
                .where(eq(elections.election, "President"));
            }
          } else if (electionStatus === "Voting") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(eq(elections.election, "President"));
            } else {
              await db
                .update(users)
                .set({ role: "Representative" })
                .where(eq(users.role, "President"));

              const candidatesRes = await db
                .select()
                .from(candidates)
                .where(eq(candidates.election, "President"))
                .orderBy(desc(candidates.votes));

              // Check if there are any candidates
              if (candidatesRes.length === 0) {
                console.log(
                  "No presidential candidates found, skipping election conclusion",
                );
                // Skip to concluded with no winner
                await db
                  .update(elections)
                  .set({ status: "Concluded", daysLeft: 8 })
                  .where(eq(elections.election, "President"));
              } else {
                let winner = candidatesRes[0];

                const topVotes = winner.votes || 0;
                const tiedCandidates = candidatesRes.filter(
                  (c) => c.votes === topVotes,
                );

                if (tiedCandidates.length > 1) {
                  const randomIndex = Math.floor(
                    Math.random() * tiedCandidates.length,
                  );
                  winner = tiedCandidates[randomIndex];
                }

                if (winner.userId) {
                  await db
                    .update(users)
                    .set({ role: "President" })
                    .where(eq(users.id, winner.userId));

                  await db.insert(feed).values({
                    userId: winner.userId,
                    content: `has been elected as the President!`,
                  });
                }

                await db
                  .update(elections)
                  .set({ status: "Concluded", daysLeft: 8 })
                  .where(eq(elections.election, "President"));
              }
            }
          } else if (electionStatus === "Concluded") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(eq(elections.election, "President"));
            } else {
              // Get all Presidential candidate IDs before deletion
              const presidentialCandidates = await db
                .select({ id: candidates.id })
                .from(candidates)
                .where(eq(candidates.election, "President"));

              const candidateIds = presidentialCandidates.map((c) => c.id);

              // Delete purchases for these candidates
              if (candidateIds.length > 0) {
                await db
                  .delete(candidatePurchases)
                  .where(inArray(candidatePurchases.candidateId, candidateIds));
              }

              await db
                .delete(candidates)
                .where(eq(candidates.election, "President"));
              await db
                .delete(candidateSnapshots)
                .where(eq(candidateSnapshots.election, "President"));
              await db
                .update(elections)
                .set({ status: "Candidate", daysLeft: 10 })
                .where(eq(elections.election, "President"));
            }
          }
        } catch (error) {
          console.error("Error handling presidential election status:", error);
          return new Response(
            JSON.stringify({
              success: false,
              error: "Internal Server Error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          console.log("[game-advance] Starting senate election processing");
          const senateElection = await db
            .select()
            .from(elections)
            .where(eq(elections.election, "Senate"));

          const electionStatus = senateElection[0]?.status;
          const daysLeft = senateElection[0]?.daysLeft;
          console.log(
            `[game-advance] Senate status: ${electionStatus}, days left: ${daysLeft}`,
          );

          if (electionStatus === "Candidate") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(eq(elections.election, "Senate"));
            } else {
              await updateSenateSeats();
              await seedCampaignItems();
              await db
                .update(elections)
                .set({ status: "Voting", daysLeft: 4 })
                .where(eq(elections.election, "Senate"));
            }
          } else if (electionStatus === "Voting") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(eq(elections.election, "Senate"));
            } else {
              await db
                .update(users)
                .set({ role: "Representative" })
                .where(eq(users.role, "Senator"));

              const seatsRes = await db
                .select()
                .from(elections)
                .where(eq(elections.election, "Senate"));

              const seats = seatsRes[0]?.seats || 1;

              const candidatesRes = await db
                .select()
                .from(candidates)
                .where(eq(candidates.election, "Senate"))
                .orderBy(desc(candidates.votes));

              const allCandidates = candidatesRes;

              if (allCandidates.length > 0) {
                const provisionalWinners = allCandidates.slice(0, seats);
                const lastWinnerVotes =
                  provisionalWinners[provisionalWinners.length - 1].votes || 0;

                const tiedCandidates = allCandidates.filter(
                  (c) => (c.votes || 0) === lastWinnerVotes,
                );

                let winners;
                if (tiedCandidates.length > 1) {
                  const nonTiedWinners = allCandidates.filter(
                    (w) => (w.votes || 0) > lastWinnerVotes,
                  );
                  const tiedSeats = seats - nonTiedWinners.length;
                  const shuffledTiedCandidates = tiedCandidates.sort(
                    () => 0.5 - Math.random(),
                  );
                  const selectedTiedWinners = shuffledTiedCandidates.slice(
                    0,
                    tiedSeats,
                  );
                  winners = nonTiedWinners.concat(selectedTiedWinners);
                } else {
                  winners = provisionalWinners;
                }

                const winnerIds = winners
                  .map((w) => w.userId)
                  .filter((id): id is number => id !== null);

                if (winnerIds.length > 0) {
                  await db
                    .update(users)
                    .set({ role: "Senator" })
                    .where(inArray(users.id, winnerIds));

                  for (const winner of winners) {
                    if (winner.userId) {
                      await db.insert(feed).values({
                        userId: winner.userId,
                        content: `has been elected as a Senator!`,
                      });
                    }
                  }
                }

                const remaining = Math.max(0, seats - winnerIds.length);
                if (remaining > 0) {
                  const fillerRes = await db
                    .select({ userId: users.id })
                    .from(users)
                    .where(
                      and(
                        sql`${users.username} NOT LIKE 'Banned User%'`,
                        sql`${users.role} NOT IN ('President', 'Senator')`,
                        winnerIds.length > 0
                          ? sql`${users.id} <> ALL(ARRAY[${sql.join(
                              winnerIds.map((id) => sql`${id}::integer`),
                              sql`, `,
                            )}])`
                          : undefined,
                      ),
                    )
                    .orderBy(sql`RANDOM()`)
                    .limit(remaining);

                  const fillers = fillerRes;

                  if (fillers.length > 0) {
                    const fillerIds = fillers.map((f) => f.userId);
                    await db
                      .update(users)
                      .set({ role: "Senator" })
                      .where(inArray(users.id, fillerIds));

                    for (const filler of fillers) {
                      await db.insert(feed).values({
                        userId: filler.userId,
                        content: `has been appointed as a Senator!`,
                      });
                    }
                  }
                }
              }

              await db
                .update(elections)
                .set({ status: "Concluded", daysLeft: 6 })
                .where(eq(elections.election, "Senate"));
            }
          } else if (electionStatus === "Concluded") {
            if (daysLeft && daysLeft > 1) {
              await db
                .update(elections)
                .set({ daysLeft: sql`${elections.daysLeft} - 1` })
                .where(eq(elections.election, "Senate"));
            } else {
              // Get all Senate candidate IDs before deletion
              const senateCandidates = await db
                .select({ id: candidates.id })
                .from(candidates)
                .where(eq(candidates.election, "Senate"));

              const candidateIds = senateCandidates.map((c) => c.id);

              // Delete purchases for these candidates
              if (candidateIds.length > 0) {
                await db
                  .delete(candidatePurchases)
                  .where(inArray(candidatePurchases.candidateId, candidateIds));
              }

              await db
                .delete(candidates)
                .where(eq(candidates.election, "Senate"));
              await db
                .delete(candidateSnapshots)
                .where(eq(candidateSnapshots.election, "Senate"));
              await db
                .update(elections)
                .set({ status: "Candidate", daysLeft: 4 })
                .where(eq(elections.election, "Senate"));
            }
          }

          // Process daily party membership fees
          // Get all parties with membership fees > 0
          console.log("[game-advance] Processing party membership fees");
          const partiesWithFees = await db
            .select({
              id: parties.id,
              partySubs: parties.partySubs,
              name: parties.name,
            })
            .from(parties)
            .where(gt(parties.partySubs, 0));
          console.log(
            `[game-advance] Found ${partiesWithFees.length} parties with fees`,
          );

          for (const party of partiesWithFees) {
            // Get all members of this party (excluding the leader)
            const partyMembers = await db
              .select({
                id: users.id,
                money: users.money,
                username: users.username,
              })
              .from(users)
              .where(
                and(eq(users.partyId, party.id), eq(users.isActive, true)),
              );

            let totalFeesCollected = 0;
            const ejectedMembers: string[] = [];

            for (const member of partyMembers) {
              const fee = party.partySubs ?? 0;
              const memberMoney = member.money ?? 0;

              if (memberMoney >= fee) {
                // Member can pay - deduct fee from member
                await db
                  .update(users)
                  .set({ money: sql`${users.money} - ${fee}` })
                  .where(eq(users.id, member.id));

                // Record user transaction
                await db.insert(transactionHistory).values({
                  userId: member.id,
                  description: `Party membership fee paid to ${party.name}: -$${fee.toLocaleString()}`,
                });

                totalFeesCollected += fee;
              } else {
                // Member cannot pay - eject from party
                await db
                  .update(users)
                  .set({ partyId: null })
                  .where(eq(users.id, member.id));

                // If this member was the leader, remove them as leader
                await db
                  .update(parties)
                  .set({ leaderId: null })
                  .where(
                    and(
                      eq(parties.id, party.id),
                      eq(parties.leaderId, member.id),
                    ),
                  );

                ejectedMembers.push(member.username);
              }
            }

            // Add collected fees to party treasury
            if (totalFeesCollected > 0) {
              await db
                .update(parties)
                .set({ money: sql`${parties.money} + ${totalFeesCollected}` })
                .where(eq(parties.id, party.id));

              // Record transaction
              await db.insert(partyTransactionHistory).values({
                partyId: party.id,
                amount: totalFeesCollected,
                description: `Daily membership fees collected from ${partyMembers.length - ejectedMembers.length} members`,
              });
            }

            // Post feed entries for ejected members
            if (ejectedMembers.length > 0) {
              await db.insert(feed).values({
                userId: null,
                content: `${ejectedMembers.length} member(s) were removed from ${party.name} for failing to pay membership fees.`,
              });
            }
          }

          console.log("[game-advance] Updating user activity");
          await db
            .update(users)
            .set({ lastActivity: sql`${users.lastActivity} + 1` });

          // Ensure users with recent activity are marked active
          await db
            .update(users)
            .set({ isActive: true })
            .where(sql`${users.lastActivity} < 14`);

          await db
            .update(users)
            .set({ isActive: false })
            .where(sql`${users.lastActivity} >= 14`);

          const inactiveUsers = await db
            .select({ id: users.id, partyId: users.partyId })
            .from(users)
            .where(
              and(eq(users.isActive, false), sql`${users.partyId} IS NOT NULL`),
            );

          const partyIds = new Set<number>();

          for (const user of inactiveUsers) {
            const partyId = user.partyId;
            if (partyId) {
              partyIds.add(partyId);

              await db
                .update(parties)
                .set({ leaderId: null })
                .where(
                  and(eq(parties.id, partyId), eq(parties.leaderId, user.id)),
                );
            }
          }

          await db
            .update(users)
            .set({ partyId: null })
            .where(eq(users.isActive, false));

          for (const partyId of partyIds) {
            const countRes = await db
              .select({ cnt: sql<number>`COUNT(*)::int` })
              .from(users)
              .where(eq(users.partyId, partyId));

            const memberCount = countRes[0]?.cnt ?? 0;

            if (memberCount === 0) {
              await db
                .delete(partyStances)
                .where(eq(partyStances.partyId, partyId));
              await db.delete(parties).where(eq(parties.id, partyId));
            }
          }

          const emptyPartyIds = await db
            .select({ id: parties.id })
            .from(parties)
            .leftJoin(users, eq(parties.id, users.partyId))
            .groupBy(parties.id)
            .having(sql`COUNT(${users.id}) = 0`);

          const emptyPartyIdList = emptyPartyIds.map((p) => p.id);

          if (emptyPartyIdList.length > 0) {
            await db
              .delete(partyStances)
              .where(inArray(partyStances.partyId, emptyPartyIdList));

            await db
              .delete(parties)
              .where(inArray(parties.id, emptyPartyIdList));
          }

          console.log("[game-advance] Game advance completed successfully");
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("[game-advance] Error in game-advance:", error);
          console.error(
            "[game-advance] Error stack:",
            error instanceof Error ? error.stack : "No stack trace",
          );
          return new Response(
            JSON.stringify({
              success: false,
              error: "Internal Server Error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
