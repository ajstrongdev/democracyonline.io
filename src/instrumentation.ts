import { NodeSDK } from "@opentelemetry/sdk-node";
import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";

export function register() {
  // Only initialize if we're in a Node.js environment (server-side)
  if (typeof window !== "undefined") {
    return;
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "democracy-online",
    [ATTR_SERVICE_VERSION]: "1.0.0",
  });

  const traceExporter = new TraceExporter();

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      new HttpInstrumentation({
        // Ignore health check endpoints to reduce noise
        ignoreIncomingRequestHook: (req) => {
          return req.url === "/api/health";
        },
      }),
    ],
  });

  sdk.start();

  // Gracefully shutdown on process termination
  process.on("SIGTERM", () => {
    sdk
      .shutdown()
      .then(() => console.log("Tracing terminated"))
      .catch((error: unknown) =>
        console.log("Error terminating tracing", error)
      )
      .finally(() => process.exit(0));
  });
}
