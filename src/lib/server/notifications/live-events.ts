import { Client } from "pg";
import { db } from "@/db";
import { users } from "@/db/schema";
import { env } from "@/env";
import { getAdminAuth } from "@/lib/firebase-admin";
import { userEmailEquals } from "@/lib/server/auth/user-email";

export type PublicChange = "dashboard" | "social";
type LiveSignal = PublicChange | "unavailable" | "ready";

const subscribers = new Set<(signal: LiveSignal) => void>();
let listener: Client | null = null;
let connecting: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function broadcast(signal: LiveSignal) {
  for (const subscriber of subscribers) {
    try {
      subscriber(signal);
    } catch (error) {
      console.error("Live subscriber failed", error);
    }
  }
}

function reconnect() {
  if (!subscribers.size || retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void ensureListening().catch((error: unknown) => {
      console.error("Live change listener could not reconnect", error);
      reconnect();
    });
  }, 2_000);
}

async function ensureListening() {
  if (listener) return;
  if (connecting) return connecting;
  connecting = (async () => {
    const client = new Client({
      connectionString: env.DATABASE_URL,
      connectionTimeoutMillis: 5_000,
      keepAlive: true,
    });
    const disconnected = () => {
      if (listener !== client) return;
      listener = null;
      broadcast("unavailable");
      reconnect();
    };
    client.on("error", (error) => {
      console.error("Live change listener disconnected", error);
      disconnected();
    });
    client.on("end", disconnected);
    client.on("notification", (message) => {
      if (message.payload !== "social" && message.payload !== "dashboard")
        return;
      broadcast(message.payload);
    });
    try {
      await client.connect();
      await client.query("LISTEN oscana_public_changes");
      listener = client;
      broadcast("ready");
      if (!subscribers.size) {
        listener = null;
        void client.end().catch(() => {});
      }
    } catch (error) {
      void client.end().catch(() => {});
      throw error;
    }
  })().finally(() => {
    connecting = null;
  });
  return connecting;
}

export async function subscribePublicChanges(
  callback: (signal: LiveSignal) => void,
) {
  subscribers.add(callback);
  try {
    await ensureListening();
  } catch (error) {
    subscribers.delete(callback);
    throw error;
  }
  return () => {
    subscribers.delete(callback);
    if (!subscribers.size) {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      const previous = listener;
      listener = null;
      if (previous) void previous.end().catch(() => {});
    }
  };
}

export async function canStreamPublicChanges(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return false;
  const session = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("__session="))
    ?.slice("__session=".length);
  if (!session) return false;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(
      decodeURIComponent(session),
      false,
    );
    if (!decoded.email) return false;
    const [player] = await db
      .select({ isActive: users.isActive })
      .from(users)
      .where(userEmailEquals(decoded.email))
      .limit(1);
    return Boolean(player && player.isActive !== false);
  } catch {
    return false;
  }
}
