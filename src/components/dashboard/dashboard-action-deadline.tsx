import { Clock3 } from "lucide-react";
import { DashboardElectionCountdown } from "@/components/dashboard/dashboard-election-countdown";

export function DashboardActionDeadline({
  deadline,
  onExpire,
  electionVoting = false,
}: {
  deadline: Date | string | null | undefined;
  onExpire: () => void;
  electionVoting?: boolean;
}) {
  const timestamp = deadline ? new Date(deadline).getTime() : Number.NaN;

  if (!Number.isFinite(timestamp)) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock3 className="size-3.5" />
      <span>
        {electionVoting ? (
          <DashboardElectionCountdown
            target={deadline ?? null}
            onExpire={onExpire}
            closingTimeOnExpire
            prefix="Closes in "
          />
        ) : (
          <>
            Closes in{" "}
            <DashboardElectionCountdown
              target={deadline ?? null}
              onExpire={onExpire}
            />
          </>
        )}
      </span>
    </span>
  );
}
