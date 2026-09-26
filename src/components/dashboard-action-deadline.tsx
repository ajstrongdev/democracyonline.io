import { Clock3 } from "lucide-react";
import { DashboardElectionCountdown } from "@/components/dashboard-election-countdown";

export function DashboardActionDeadline({ deadline, onExpire }: {
  deadline: Date | string | null | undefined;
  onExpire: () => void;
}) {
  const timestamp = deadline ? new Date(deadline).getTime() : Number.NaN;

  if (!Number.isFinite(timestamp)) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock3 className="size-3.5" />
      <span>Closes in <DashboardElectionCountdown target={deadline ?? null} onExpire={onExpire} /></span>
    </span>
  );
}
