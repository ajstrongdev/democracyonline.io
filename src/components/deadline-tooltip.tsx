import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function DeadlineTooltip({ target, children }: { target: Date | string | null | undefined; children: ReactNode }) {
  const [localDate, setLocalDate] = useState<string | null>(null);
  const timestamp = target ? new Date(target).getTime() : Number.NaN;

  useEffect(() => {
    setLocalDate(Number.isFinite(timestamp)
      ? new Date(timestamp).toLocaleString(undefined, {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
          hour: "numeric", minute: "2-digit", timeZoneName: "short",
        })
      : null);
  }, [timestamp]);

  if (!Number.isFinite(timestamp)) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={localDate ? `Deadline: ${localDate}` : "Deadline countdown"}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={8} className="max-w-[min(22rem,calc(100vw-2rem))] border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg [&>svg]:bg-popover [&>svg]:fill-popover">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your local deadline</p>
        <p className="mt-1 text-sm font-medium">{localDate ?? "Loading local time…"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
