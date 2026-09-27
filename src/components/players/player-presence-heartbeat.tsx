import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { recordPlayerPresence } from "@/lib/server/player-presence";

export function PlayerPresenceHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let lastSentAt = 0;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastSentAt < 60_000) return;
      lastSentAt = now;
      void recordPlayerPresence().catch((error: unknown) => {
        console.error("Could not update player presence", error);
        lastSentAt = 0;
      });
    };
    refresh();
    const interval = window.setInterval(refresh, 2 * 60_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [user?.uid]);

  return null;
}
