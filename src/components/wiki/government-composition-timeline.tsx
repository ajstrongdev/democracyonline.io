import { Link } from "@tanstack/react-router";

type Composition = {
  key: string;
  name: string;
  color: string;
  house: number;
  senate: number;
  president: number;
};

type Snapshot = {
  id: string;
  electionId: number | null;
  label: string;
  type: string;
  date: string;
  composition: Array<Composition>;
};

const chambers = [
  { title: "House", key: "house" },
  { title: "Senate", key: "senate" },
  { title: "Presidency", key: "president" },
] as const;

export function GovernmentCompositionTimeline({
  snapshots,
}: {
  snapshots: Array<Snapshot>;
}) {
  return (
    <section className="wiki-section px-4 py-6 sm:px-8">
      <div className="mb-7 border-b pb-4">
        <h2 className="font-serif text-2xl font-semibold">Government record</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Seat totals after each election or recorded membership change. Changes
          are measured against the preceding government.
        </p>
      </div>
      <div className="ml-2 border-l-2 border-primary/25 sm:ml-3">
        {snapshots.map((snapshot, index) => (
          <article
            key={snapshot.id}
            className="relative pb-9 pl-6 last:pb-0 sm:pl-9"
          >
            <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary ring-2 ring-primary/20" />
            <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div>
                <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {snapshot.type}
                </span>
                {snapshot.electionId ? (
                  <Link
                    to="/dashboard/elections/$electionId"
                    params={{ electionId: String(snapshot.electionId) }}
                    className="font-serif text-xl font-semibold hover:text-primary"
                  >
                    {snapshot.label}
                  </Link>
                ) : (
                  <h3 className="font-serif text-xl font-semibold">
                    {snapshot.label}
                  </h3>
                )}
              </div>
              <time className="font-mono text-xs text-muted-foreground">
                {snapshot.date}
              </time>
            </header>
            <div className="grid gap-3 lg:grid-cols-3">
              {chambers.map((chamber) => (
                <Chamber
                  key={chamber.key}
                  title={chamber.title}
                  office={chamber.key}
                  composition={snapshot.composition}
                  previous={snapshots[index + 1]?.composition}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
      {!snapshots.length && (
        <p className="text-sm text-muted-foreground">
          No certified governments have been recorded yet.
        </p>
      )}
    </section>
  );
}

function Chamber({
  title,
  office,
  composition,
  previous,
}: {
  title: string;
  office: "house" | "senate" | "president";
  composition: Array<Composition>;
  previous?: Array<Composition>;
}) {
  const currentSeats = new Map(
    composition.map((party) => [party.key, party[office]]),
  );
  const previousSeats = new Map(
    previous?.map((party) => [party.key, party[office]]) ?? [],
  );
  const parties = new Map(previous?.map((party) => [party.key, party]) ?? []);
  for (const party of composition) parties.set(party.key, party);
  const rows = [...parties.values()]
    .filter(
      (party) =>
        (currentSeats.get(party.key) ?? 0) > 0 ||
        (previousSeats.get(party.key) ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        (currentSeats.get(b.key) ?? 0) - (currentSeats.get(a.key) ?? 0) ||
        a.name.localeCompare(b.name),
    );

  return (
    <div className="rounded-lg border bg-background/60 p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">
        {rows.map((party) => {
          const seats = currentSeats.get(party.key) ?? 0;
          const change = previous
            ? seats - (previousSeats.get(party.key) ?? 0)
            : 0;
          return (
            <div
              key={party.key}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: party.color }}
                />
                <span className="truncate">{party.name}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2 font-mono">
                <strong className="text-base">{seats}</strong>
                {change !== 0 && (
                  <span
                    className={change > 0 ? "text-emerald-600" : "text-red-600"}
                  >
                    {change > 0 ? "+" : ""}
                    {change}
                  </span>
                )}
              </span>
            </div>
          );
        })}
        {!rows.length && (
          <span className="text-sm text-muted-foreground">Vacant</span>
        )}
      </div>
    </div>
  );
}
