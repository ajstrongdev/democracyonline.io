import { Check } from "lucide-react";

/** Show the public legislative path without exposing the underlying status codes. */
export function BillProgress({ status, stage }: { status: string; stage: string }) {
  const steps = ["Committee", "House vote", "Senate vote", "President", "Outcome"];
  const current = status === "Committee" ? 0 : status === "Voting"
    ? stage === "House" ? 1 : stage === "Senate" ? 2 : 3
    : 4;
  const state = status === "Passed" ? "Passed" : status === "Defeated" ? "Defeated" : "Final decision";

  return (
    <section aria-label="Legislative progress" className="border bg-card px-3 py-4 sm:px-5">
      <p className="wiki-kicker mb-3">Legislative progress</p>
      <ol className="grid grid-cols-2 gap-x-2 gap-y-3 text-xs sm:grid-cols-5 sm:gap-3">
        {steps.map((step, index) => {
          const label = index === 4 ? state : step;
          const active = index === current;
          return (
            <li key={step} aria-current={active ? "step" : undefined} className={`flex min-w-0 items-center gap-2 border-l-2 pl-2.5 sm:flex-col sm:items-start sm:border-l-0 sm:border-t-2 sm:pl-0 sm:pt-2 ${active ? "border-primary text-foreground" : index < current ? "border-primary/40 text-muted-foreground" : "border-border text-muted-foreground"}`}>
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-current font-mono text-[10px]" aria-hidden="true">
                {index < current ? <Check className="size-3" /> : index + 1}
              </span>
              <span className={active ? "font-semibold" : undefined}>{label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
