import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

export const socialChangeEvent = "oscana:social-change";

export function LiveUpdates() {
  const { user, sessionReady } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    let connected = false;
    const refresh = (social = true) => {
      if (document.visibilityState !== "visible") return;
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (social) {
        void queryClient.invalidateQueries({ queryKey: ["social", "feed"] });
        void queryClient.invalidateQueries({ queryKey: ["notifications", "social"] });
        window.dispatchEvent(new Event(socialChangeEvent));
      }
    };
    if (!sessionReady) {
      const fallback = window.setInterval(() => refresh(), 10_000);
      return () => window.clearInterval(fallback);
    }
    const stream = new EventSource("/api/live");
    stream.addEventListener("change", (event) => {
      if (event.data === "social" || event.data === "dashboard")
        refresh(event.data === "social");
    });
    stream.addEventListener("ready", () => {
      connected = true;
      refresh();
    });
    stream.addEventListener("unavailable", () => {
      connected = false;
    });
    stream.onopen = () => {
      connected = true;
      refresh();
    };
    stream.onerror = () => {
      connected = false;
    };
    const fallback = window.setInterval(() => {
      if (!connected) refresh();
    }, 10_000);
    const onReturn = () => refresh();
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("online", onReturn);
    return () => {
      stream.close();
      window.clearInterval(fallback);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("online", onReturn);
    };
  }, [user?.uid, sessionReady, queryClient]);

  return null;
}
