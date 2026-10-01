export function reconcileBallotDraft(roster: Array<number>, draft: unknown): Array<number> {
  if (!Array.isArray(draft)) return roster;
  const valid = new Set(roster);
  const seen = new Set<number>();
  const saved = draft.filter((id): id is number => {
    if (typeof id !== "number" || !valid.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return [...saved, ...roster.filter((id) => !seen.has(id))];
}
