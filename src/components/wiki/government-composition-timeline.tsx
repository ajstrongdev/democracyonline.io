import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PartyCompositionBar } from "@/components/wiki/party-composition-bar";

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
  kind: "defection" | "election" | "coup";
  election: string | null;
  date: string;
  composition: Array<Composition>;
  coalitionComposition: Array<Composition>;
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
  const [showDefections, setShowDefections] = useState(true);
  const [view, setView] = useState<"parties" | "coalitions">("parties");
  const [showCoups, setShowCoups] = useState(true);
  const [showPresidential, setShowPresidential] = useState(true);
  const [showSenate, setShowSenate] = useState(true);
  const visibleSnapshots = useMemo(
    () =>
      snapshots.filter((snapshot) => {
        if (snapshot.kind === "defection") return showDefections;
        if (snapshot.kind === "coup") return showCoups;
        if (snapshot.election === "President") return showPresidential;
        if (snapshot.election === "Senate") return showSenate;
        return true;
      }),
    [snapshots, showDefections, showCoups, showPresidential, showSenate],
  );

  return (
    <section className="wiki-section overflow-hidden">
      <header className="wiki-section-header">
        <div>
          <h2 className="wiki-section-title">Government record</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Seat totals after each election, coup, or recorded membership
            change. Changes are measured against the preceding government.
          </p>
        </div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          Latest first
        </span>
      </header>
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 text-sm sm:px-6">
        <span className="font-medium">Show seats by</span>
        <div
          className="inline-flex rounded-md border p-0.5"
          role="group"
          aria-label="Show seats by"
        >
          {(["parties", "coalitions"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={`rounded px-3 py-1 font-medium capitalize ${view === option ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-b px-4 py-3 text-sm sm:px-6">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showCoups}
            onChange={(event) => setShowCoups(event.target.checked)}
          />
          Coups
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showDefections}
            onChange={(event) => setShowDefections(event.target.checked)}
          />
          Party switches
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showSenate}
            onChange={(event) => setShowSenate(event.target.checked)}
          />
          Senate election snapshots
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showPresidential}
            onChange={(event) => setShowPresidential(event.target.checked)}
          />
          Presidential election snapshots
        </label>
      </div>
      <div className="wiki-section-content px-3 py-6 sm:px-6 sm:py-8">
        {visibleSnapshots.length ? (
          <div className="ml-2 border-l-2 border-primary/25 sm:ml-3">
            {visibleSnapshots.map((snapshot, index) => (
              <article
                key={snapshot.id}
                className="relative pb-9 pl-6 last:pb-0 sm:pl-9"
              >
                <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary ring-2 ring-primary/20" />
                <header className="mb-4 flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <span className="wiki-kicker mb-1 block">
                      {snapshot.type}
                    </span>
                    {snapshot.electionId ? (
                      <Link
                        to="/dashboard/elections/$electionId"
                        params={{ electionId: String(snapshot.electionId) }}
                        className="font-serif text-xl font-semibold hover:text-primary sm:text-2xl"
                      >
                        {snapshot.label}
                      </Link>
                    ) : (
                      <h3 className="font-serif text-xl font-semibold sm:text-2xl">
                        {snapshot.label}
                      </h3>
                    )}
                  </div>
                  <time className="shrink-0 font-mono text-xs text-muted-foreground">
                    {snapshot.date}
                  </time>
                </header>
                <div className="grid gap-3 lg:grid-cols-3">
                  {chambers.map((chamber) => (
                    <Chamber
                      key={chamber.key}
                      title={chamber.title}
                      office={chamber.key}
                      composition={
                        view === "parties"
                          ? snapshot.composition
                          : snapshot.coalitionComposition
                      }
                      previous={
                        view === "parties"
                          ? visibleSnapshots[index + 1]?.composition
                          : visibleSnapshots[index + 1]?.coalitionComposition
                      }
                    />
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
            No government events match these filters.
          </p>
        )}
      </div>
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
    <div className="rounded-sm border bg-background/60 p-3 shadow-none sm:p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h3>
        <span className="font-mono text-[0.65rem] text-muted-foreground">
          {rows.reduce(
            (sum, party) => sum + (currentSeats.get(party.key) ?? 0),
            0,
          )}{" "}
          seats
        </span>
      </div>
      <div className="mt-3">
        <PartyCompositionBar
          groups={rows.map((party) => ({
            name: party.name,
            color: party.color,
            count: currentSeats.get(party.key) ?? 0,
          }))}
          label={`${title} composition`}
        />
      </div>
      <div className="mt-4 space-y-2 border-t pt-3">
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
