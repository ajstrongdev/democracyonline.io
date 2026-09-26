export const playerArchiveAfterMs = 14 * 24 * 60 * 60 * 1_000;

export function playerArchiveCutoff(now: Date): Date {
  return new Date(now.getTime() - playerArchiveAfterMs);
}
