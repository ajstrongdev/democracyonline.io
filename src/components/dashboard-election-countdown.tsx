import { useEffect, useEffectEvent, useState } from "react";

function formatRemaining(milliseconds: number) {
  if (milliseconds <= 0) return "Closing now";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function DashboardElectionCountdown({
  target,
  onExpire,
}: {
  target: Date | string | null;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const expire = useEffectEvent(onExpire);
  const targetTime = target ? new Date(target).getTime() : Number.NaN;

  useEffect(() => {
    if (!Number.isFinite(targetTime)) {
      setRemaining(null);
      return;
    }

    let expired = false;
    const update = () => {
      const next = Math.max(0, targetTime - Date.now());
      setRemaining(next);
      if (next === 0 && !expired) {
        expired = true;
        expire();
      }
    };

    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [targetTime]);

  return (
    <span className="font-mono tabular-nums" aria-live="off">
      {remaining === null ? "Calculating..." : formatRemaining(remaining)}
    </span>
  );
}
