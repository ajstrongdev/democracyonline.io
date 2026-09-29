import { createFileRoute } from "@tanstack/react-router";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bills,
  candidates,
  elections,
  parties,
  socialPosts,
  users,
} from "@/db/schema";
import { groupBotBills, parseBotQuery } from "@/lib/bot-api";

const publicHeaders = {
  "Cache-Control": "public, max-age=15",
  "X-Content-Type-Options": "nosniff",
};
const errorHeaders = { "Cache-Control": "no-store" };

const userFields = {
  id: users.id,
  username: users.username,
  bio: users.bio,
  role: users.role,
  partyId: users.partyId,
  politicalLeaning: users.politicalLeaning,
  isActive: users.isActive,
  lastSeenAt: users.lastSeenAt,
  archivedAt: users.archivedAt,
  partyName: parties.name,
  partyColor: parties.color,
};

const partyFields = {
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
};

const billFields = {
  id: bills.id,
  status: bills.status,
  stage: bills.stage,
  title: bills.title,
  creatorId: bills.creatorId,
  content: bills.content,
  createdAt: bills.createdAt,
  pool: bills.pool,
  creatorUsername: users.username,
};

const candidateFields = {
  id: candidates.id,
  userId: candidates.userId,
  username: users.username,
  election: candidates.election,
  points: sql<
    number | null
  >`case when ${elections.status} = 'CONCLUDED' then ${candidates.votes} else null end`,
  partyId: users.partyId,
  partyName: parties.name,
  partyColor: parties.color,
};

const candidateOrder = sql`case when ${elections.status} = 'CONCLUDED' then ${candidates.votes} end desc nulls last`;

export const Route = createFileRoute("/api/bot")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const parsed = parseBotQuery(new URL(request.url));
        if (!parsed.ok)
          return Response.json(
            { error: parsed.error },
            { status: 400, headers: errorHeaders },
          );
        const query = parsed.query;

        try {
          if (query.endpoint === "users") {
            const rows = await db
              .select(userFields)
              .from(users)
              .leftJoin(parties, eq(users.partyId, parties.id))
              .where(query.id === null ? undefined : eq(users.id, query.id))
              .orderBy(users.id)
              .limit(query.id === null ? query.limit : 1)
              .offset(query.id === null ? query.offset : 0);
            if (query.id !== null && !rows.length)
              return Response.json(
                { error: "User not found" },
                { status: 404, headers: errorHeaders },
              );
            return Response.json(query.id === null ? rows : rows[0], {
              headers: publicHeaders,
            });
          }

          if (query.endpoint === "parties") {
            const rows = await db
              .select(partyFields)
              .from(parties)
              .where(query.id === null ? undefined : eq(parties.id, query.id))
              .orderBy(parties.id)
              .limit(query.id === null ? query.limit : 1)
              .offset(query.id === null ? query.offset : 0);
            if (query.id !== null && !rows.length)
              return Response.json(
                { error: "Party not found" },
                { status: 404, headers: errorHeaders },
              );
            if (query.id === null)
              return Response.json(rows, { headers: publicHeaders });
            const members = await db
              .select({
                id: users.id,
                username: users.username,
                role: users.role,
              })
              .from(users)
              .where(eq(users.partyId, query.id))
              .orderBy(users.id);
            return Response.json(
              { ...rows[0], members },
              { headers: publicHeaders },
            );
          }

          if (query.endpoint === "bills") {
            const rows = await db
              .select(billFields)
              .from(bills)
              .leftJoin(users, eq(bills.creatorId, users.id))
              .where(
                and(
                  query.stage ? eq(bills.stage, query.stage) : undefined,
                  query.status ? eq(bills.status, query.status) : undefined,
                ),
              )
              .orderBy(bills.id)
              .limit(query.limit)
              .offset(query.offset);
            return Response.json(
              query.stage || query.status ? rows : groupBotBills(rows),
              { headers: publicHeaders },
            );
          }

          if (query.endpoint === "posts") {
            const rows = await db
              .select({
                id: socialPosts.id,
                userId: socialPosts.userId,
                username: socialPosts.username,
                accountKey: socialPosts.accountKey,
                accountPartyId: socialPosts.accountPartyId,
                content: socialPosts.content,
                createdAt: socialPosts.createdAt,
              })
              .from(socialPosts)
              .orderBy(
                sql`${socialPosts.createdAt} DESC, ${socialPosts.id} DESC`,
              )
              .limit(query.limit)
              .offset(query.offset);
            return Response.json(rows, { headers: publicHeaders });
          }

          if (query.endpoint === "candidates") {
            const rows = await db
              .select(candidateFields)
              .from(candidates)
              .innerJoin(users, eq(candidates.userId, users.id))
              .leftJoin(parties, eq(users.partyId, parties.id))
              .innerJoin(elections, eq(candidates.election, elections.election))
              .where(
                query.election
                  ? eq(candidates.election, query.election)
                  : undefined,
              )
              .orderBy(candidateOrder, candidates.id)
              .limit(query.limit)
              .offset(query.offset);
            return Response.json(rows, { headers: publicHeaders });
          }

          const races = await db
            .select({
              election: elections.election,
              status: elections.status,
              seats: elections.seats,
              cycle: elections.cycle,
              candidacyStartsAt: elections.candidacyStartsAt,
              candidacyEndsAt: elections.candidacyEndsAt,
              votingStartsAt: elections.votingStartsAt,
              votingEndsAt: elections.votingEndsAt,
              electionNightStartsAt: elections.electionNightStartsAt,
              electionNightEndsAt: elections.electionNightEndsAt,
              concludedAt: elections.concludedAt,
            })
            .from(elections)
            .where(inArray(elections.election, ["President", "Senate"]))
            .orderBy(elections.election);
          const roster = await db
            .select(candidateFields)
            .from(candidates)
            .innerJoin(users, eq(candidates.userId, users.id))
            .leftJoin(parties, eq(users.partyId, parties.id))
            .innerJoin(elections, eq(candidates.election, elections.election))
            .where(inArray(candidates.election, ["President", "Senate"]))
            .orderBy(candidateOrder, candidates.id);
          return Response.json(
            races.map((race) => ({
              ...race,
              candidates: roster.filter(
                (candidate) => candidate.election === race.election,
              ),
            })),
            { headers: publicHeaders },
          );
        } catch (error) {
          console.error("Bot API request failed", error);
          return Response.json(
            { error: "Internal server error" },
            { status: 500, headers: errorHeaders },
          );
        }
      },
    },
  },
});
