export type PartyCompositionSlice = {
  name: string;
  color: string;
  count: number;
};

export function PartyCompositionBar({
  groups,
  label,
}: {
  groups: Array<PartyCompositionSlice>;
  label: string;
}) {
  const total = groups.reduce((sum, group) => sum + group.count, 0);

  if (!total) {
    return <p className="text-sm text-muted-foreground">No seats recorded.</p>;
  }

  return (
    <div
      className="flex h-7 w-full overflow-hidden rounded-sm bg-muted"
      role="img"
      aria-label={`${label}: ${groups
        .map((group) => `${group.name} ${group.count}`)
        .join(", ")}`}
    >
      {groups
        .filter((group) => group.count > 0)
        .map((group) => (
          <div
            key={group.name}
            className="min-w-[3px] border-r border-background/70 last:border-r-0"
            style={{
              flexGrow: group.count,
              flexBasis: 0,
              backgroundColor: group.color,
              backgroundImage: group.name === "Independent" ? "repeating-linear-gradient(135deg, transparent 0 4px, rgba(255,255,255,.35) 4px 7px)" : undefined,
            }}
            title={`${group.name}: ${group.count}`}
          />
        ))}
    </div>
  );
}
