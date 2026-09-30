export const COALITION_MIN_PARTIES = 3;

/** Membership determines the public designation; no separate status can go stale. */
export function coalitionDesignation(
  memberCount: number,
): "Coalition" | "Electoral Pact" {
  return memberCount >= COALITION_MIN_PARTIES ? "Coalition" : "Electoral Pact";
}
