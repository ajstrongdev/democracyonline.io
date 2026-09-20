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
      {groups.map((group) => (
        <div
          key={group.name}
          className="min-w-1 border-r border-background/70 last:border-r-0"
          style={{
            width: `${(group.count / total) * 100}%`,
            backgroundColor: group.color,
          }}
          title={`${group.name}: ${group.count}`}
        />
      ))}
    </div>
  );
}
