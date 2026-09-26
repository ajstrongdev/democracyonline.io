export function getMentionAccounts(
  player: { username: string; role: string | null; isActive: boolean | null },
  ledParties: Array<{ id: number; name: string }>,
) {
  const escapeRegex = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const accounts = [
    { key: "player", label: `@${player.username}`, names: [player.username] },
    ...(player.role === "President" && player.isActive
      ? [{ key: "potro", label: "POTRO", names: ["POTRO", "POTUS"] }]
      : []),
    ...ledParties
      .map((party) => ({
        key: `party:${party.id}`,
        label: party.name,
        names: [
          party.name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
        ],
      }))
      .filter((party) => party.names[0]),
  ];
  return accounts.map((account) => ({
    key: account.key,
    label: account.label,
    pattern: `(^|[^[:alnum:]_])@(${account.names.map(escapeRegex).join("|")})($|[^[:alnum:]_])`,
  }));
}

/** A player can mention their other identities, but not the identity posting. */
export function isSameMentionAccount(
  source: {
    userId: number | null;
    accountKey: string | null;
    partyId?: number | null;
    isComment?: boolean;
  },
  targetAccountKey: string,
  viewerId: number,
) {
  if (source.userId !== viewerId) return false;
  const sourceKey = source.isComment
    ? "player"
    : source.accountKey === "party"
      ? `party:${source.partyId ?? "unknown"}`
      : source.accountKey === "potro"
        ? "potro"
        : "player";
  return sourceKey === targetAccountKey;
}
