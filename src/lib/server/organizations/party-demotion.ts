import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  parties,
  pressureGroupMembers,
  pressureGroups,
  users,
  wikiArticleRevisions,
  wikiArticles,
} from "@/db/schema";
import { archivePartyIfEmpty } from "@/lib/server/organizations/organization-lifecycle";

/** Called by the minute cron, independently of the game-speed throttle. */
export async function demoteSmallParties() {
  const candidates = await db
    .select({ id: parties.id })
    .from(parties)
    .leftJoin(users, eq(users.partyId, parties.id))
    .where(isNull(parties.archivedAt))
    .groupBy(parties.id)
    .having(sql`count(${users.id}) < 3`);
  let converted = 0;
  for (const candidate of candidates) {
    const didConvert = await db.transaction(async (tx) => {
      // Same party advisory lock used by the empty-party archival path.
      await tx.execute(sql`select pg_advisory_xact_lock(${candidate.id})`);
      const [party] = await tx
        .select()
        .from(parties)
        .where(and(eq(parties.id, candidate.id), isNull(parties.archivedAt)))
        .for("update");
      if (!party) return false;
      const members = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.partyId, party.id))
        .orderBy(users.id)
        .for("update");
      if (members.length === 0) {
        await archivePartyIfEmpty(tx, party.id);
        return false;
      }
      if (members.length >= 3) return false;

      const [priorGroup] = await tx
        .select()
        .from(pressureGroups)
        .where(eq(pressureGroups.formedPartyId, party.id))
        .for("update");
      const founderId = members.some(({ id }) => id === party.leaderId)
        ? party.leaderId!
        : members[0].id;
      const [platform] = await tx
        .select({ content: wikiArticleRevisions.content })
        .from(wikiArticles)
        .innerJoin(
          wikiArticleRevisions,
          eq(wikiArticleRevisions.articleId, wikiArticles.id),
        )
        .where(
          and(
            eq(wikiArticles.entityType, "party"),
            eq(wikiArticles.entityId, String(party.id)),
          ),
        )
        .orderBy(desc(wikiArticleRevisions.createdAt), desc(wikiArticleRevisions.id))
        .limit(1);
      const details = {
        party: {
          name: party.name,
          bio: party.bio ?? "",
          color: party.color,
          logo: party.logo,
          leaning: party.leaning ?? "",
          discord: party.discord,
        },
        platform: platform?.content ?? priorGroup?.details.platform ?? "",
      };
      const [group] = priorGroup
        ? await tx
            .update(pressureGroups)
            .set({
              founderId,
              name: party.name,
              details,
              formedPartyId: null,
              dormantPartyId: party.id,
            })
            .where(eq(pressureGroups.id, priorGroup.id))
            .returning({ id: pressureGroups.id })
        : await tx
            .insert(pressureGroups)
            .values({
              founderId,
              name: party.name,
              details,
              dormantPartyId: party.id,
            })
            .returning({ id: pressureGroups.id });
      await tx
        .update(users)
        .set({ partyId: null })
        .where(eq(users.partyId, party.id));
      await tx
        .insert(pressureGroupMembers)
        .values(members.map(({ id }) => ({ groupId: group.id, userId: id })));
      await archivePartyIfEmpty(tx, party.id, null, true);
      return true;
    });
    if (didConvert) converted += 1;
  }
  return converted;
}
