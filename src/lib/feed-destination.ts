import { getEntityReferenceHref } from "@/lib/entity-references";

/** Feed rows predate destination metadata; route legacy entries by their event text. */
export function getFeedDestination(content: string, userId: number | null): string {
  const text = content.toLowerCase();

  // Prefer the event itself over references a player may have included in a post.
  if (text.includes("z.com")) return "/social";

  const bill = content.match(/\bbill\s+#(\d+)\b/i);
  if (bill) return getEntityReferenceHref(bill[0])!;

  const electionArticle = content.match(/\belection\s+(current-(?:president|senate)|\d+)\s+article\b/i);
  if (electionArticle) return `/dashboard/elections/${electionArticle[1]}`;

  const election = content.match(/\b(presidential|senate)\s+election\s+#\d+\b/i);
  if (election) return getEntityReferenceHref(election[0])!;

  const party = content.match(/\bparty\s+#\d+\b/i);
  if (party) return getEntityReferenceHref(party[0])!;

  const player = content.match(/\bplayer\s+#\d+\b/i);
  if (player) return getEntityReferenceHref(player[0])!;

  if (text.includes("presidential primary")) return "/dashboard/parties/primaries";
  if (text.includes("coalition")) return "/dashboard/parties/coalitions";
  if (text.includes("party") || /\b(formed|revived)\b/.test(text))
    return "/dashboard/parties";
  if (/\b(candidate|elected|senator|president|election)\b/.test(text))
    return "/dashboard/elections";
  if (text.includes("government wiki")) return "/dashboard/government";

  return userId ? `/dashboard/players/${userId}` : "/dashboard";
}
