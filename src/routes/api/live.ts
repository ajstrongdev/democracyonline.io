import { createFileRoute } from "@tanstack/react-router";
import {
  canStreamPublicChanges,
  subscribePublicChanges,
} from "@/lib/server/notifications/live-events";

export const Route = createFileRoute("/api/live")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await canStreamPublicChanges(request))) {
          return new Response(null, {
            status: 401,
            headers: { "Cache-Control": "no-store" },
          });
        }

        const encoder = new TextEncoder();
        let controller: ReadableStreamDefaultController<Uint8Array> | null =
          null;
        let closed = false;
        let unsubscribe = () => {};
        const send = (message: string) => {
          if (!closed && controller)
            controller.enqueue(encoder.encode(message));
        };
        try {
          unsubscribe = await subscribePublicChanges((signal) => {
            if (signal === "ready" || signal === "unavailable")
              send(`event: ${signal}\ndata: ${signal}\n\n`);
            else send(`event: change\ndata: ${signal}\n\n`);
          });
        } catch (error) {
          console.error("Live changes unavailable", error);
          return new Response(null, {
            status: 503,
            headers: { "Cache-Control": "no-store" },
          });
        }
        const close = () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          clearTimeout(lifetime);
          request.signal.removeEventListener("abort", close);
          unsubscribe();
          try {
            controller?.close();
          } catch {
            /* The browser may already have disconnected. */
          }
        };
        const body = new ReadableStream<Uint8Array>({
          start(stream) {
            controller = stream;
            send("retry: 3000\n: connected\n\n");
          },
          cancel: close,
        });
        const heartbeat = setInterval(() => send(": keepalive\n\n"), 20_000);
        const lifetime = setTimeout(close, 5 * 60_000); // Reauthenticate on reconnect.
        request.signal.addEventListener("abort", close, { once: true });

        return new Response(body, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-store, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
