/** Add a reply recipient without replacing a draft or repeating its leading mention. */
export function mentionDraft(draft: string, username: string): string {
  const mention = `@${username}`;
  const start = draft.trimStart();
  if (start.slice(0, mention.length).toLowerCase() === mention.toLowerCase() &&
      (start.length === mention.length || /\s/.test(start[mention.length]))) return draft;
  return `${mention} ${draft}`;
}
