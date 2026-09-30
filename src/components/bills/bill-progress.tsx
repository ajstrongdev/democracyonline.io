import { Check } from "lucide-react";

/** Show the public legislative path without exposing the underlying status codes. */
export function BillProgress({
  status,
  stage,
}: {
  status: string;
  stage: string;
}) {
  const steps = ["Committee", "House vote", "Senate vote", "President"];
  const current =
    status === "Committee" || stage === "Committee"
      ? 0
      : stage === "House"
        ? 1
        : stage === "Senate"
          ? 2
          : 3;
  const concluded = status === "Passed" || status === "Defeated";

  return (
    <section
      aria-label="Legislative progress"
      className="border bg-card px-3 py-4 sm:px-5"
    >
      <p className="wiki-kicker mb-3">Legislative progress</p>
      <ol className="grid grid-cols-2 gap-x-2 gap-y-3 text-xs sm:grid-cols-4 sm:gap-3">
        {steps.map((step, index) => {
          const active = !concluded && index === current;
          const completed = index < current || (concluded && index === current);
          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className={`flex min-w-0 items-center gap-2 border-l-2 pl-2.5 sm:flex-col sm:items-start sm:border-l-0 sm:border-t-2 sm:pl-0 sm:pt-2 ${active ? "border-primary text-foreground" : completed ? "border-primary/40 text-muted-foreground" : "border-border text-muted-foreground"}`}
            >
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-full border border-current font-mono text-[10px]"
                aria-hidden="true"
              >
                {completed ? <Check className="size-3" /> : index + 1}
              </span>
              <span className={active ? "font-semibold" : undefined}>
                {step}
              </span>
            </li>
          );
        })}
      </ol>
      {concluded && (
        <p className="mt-3 text-sm font-semibold" role="status">
          Result: {status}
        </p>
      )}
    </section>
  );
}
