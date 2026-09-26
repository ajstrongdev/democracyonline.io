const target = process.env.APP_BASE_URL || "http://app:3000";
const token = process.env.CRON_INTERNAL_TOKEN;
const intervalMs = Number.parseInt(
  process.env.SCHEDULER_INTERVAL_MS || "60000",
  10,
);
const requestTimeoutMs = Number.parseInt(
  process.env.SCHEDULER_REQUEST_TIMEOUT_MS || "30000",
  10,
);
// game-advance self-throttles server-side (game_settings.last_game_advance_at
// at game pace: 24h at regular speed), so it is safe to call every tick and
// log skips quietly. Election + bill endpoints reconcile due deadlines and
// are idempotent.

if (!token) {
  console.error(
    "[scheduler] CRON_INTERNAL_TOKEN is not set. " +
      "Set it in .env to match the app container, then recreate the scheduler. " +
      "Refusing to loop with 401s.",
  );
  process.exit(1);
}

if (!Number.isFinite(intervalMs) || intervalMs < 5_000) {
  console.error(
    `[scheduler] Invalid SCHEDULER_INTERVAL_MS: ${process.env.SCHEDULER_INTERVAL_MS}`,
  );
  process.exit(1);
}

let consecutiveFailures = 0;

console.log(`[scheduler] starting target=${target} intervalMs=${intervalMs}`);

async function call(path, method, logSuccess = true, skipLogIf = null) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${target}${path}`, {
      method,
      headers: { "x-internal-cron-token": token },
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok)
      throw new Error(`${path} returned ${response.status}: ${body}`);
    if (logSuccess && !(skipLogIf && skipLogIf(body))) {
      console.log(
        `[scheduler] ${new Date().toISOString()} ${path} ${response.status} ${Date.now() - startedAt}ms`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function tick() {
  let failures = 0;
  const jobs = [
    { path: "/api/election-advance", method: "POST" },
    { path: "/api/bill-advance", method: "GET" },
    {
      path: "/api/game-advance",
      method: "GET",
      skipLogIf: (body) => body.includes('"skipped":true'),
    },
  ];

  for (const job of jobs) {
    try {
      await call(job.path, job.method, true, job.skipLogIf);
    } catch (error) {
      failures += 1;
      const hint = error?.message?.includes("401")
        ? " Check CRON_INTERNAL_TOKEN matches the app container."
        : error?.message?.includes("fetch failed") ||
            error?.name === "AbortError"
          ? " App may still be starting; will retry."
          : "";
      console.error(
        `[scheduler] ${job.path} failed.${hint}`,
        error?.message ?? error,
      );
    }
  }

  if (failures === 0) {
    consecutiveFailures = 0;
  } else {
    consecutiveFailures += 1;
    console.error(
      `[scheduler] tick completed with ${failures} failure(s) (${consecutiveFailures} consecutive failing ticks)`,
    );
  }

  setTimeout(tick, intervalMs);
}

// Small initial delay so `depends_on: app` doesn't hammer a cold Nitro boot.
setTimeout(tick, 5_000);
