// VS Code's safe, disposable local stack. Never falls back to the repository
// .env: it may point at production Firebase and a deployed database.
import { spawn, spawnSync } from "node:child_process";
import { createConnection } from "node:net";
import { resolve } from "node:path";
import pg from "pg";

const root = resolve(import.meta.dirname, "../..");
const containerName = `oscana-vscode-${process.pid}`;
const dbUrl = "postgresql://e2e:e2e@127.0.0.1:55440/oscana_e2e";
const siteUrl = "http://127.0.0.1:31017";
const children = [];
let containerStarted = false;
let shuttingDown = false;

const runtime = ["podman", "docker"].find((name) =>
  spawnSync(name, ["--version"], { stdio: "ignore" }).status === 0,
);
if (!runtime) throw new Error("Install Podman or Docker to use the isolated VS Code stack");

function run(command, args, env) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
    child.once("error", fail);
    child.once("exit", (code) => code === 0 ? done() : fail(new Error(`${command} ${args.join(" ")} exited ${code}`)));
  });
}

function start(command, args, env) {
  const child = spawn(command, args, { cwd: root, env, stdio: "inherit", detached: true });
  children.push(child);
  child.once("exit", (code) => {
    if (!shuttingDown) {
      console.error(`[local] ${command} exited (${code}); stopping the isolated stack`);
      void cleanup();
    }
  });
  return child;
}

async function waitForPort(port, child, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) throw new Error(`Service on ${port} exited before becoming ready`);
    const available = await new Promise((done) => {
      const socket = createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => { socket.destroy(); done(true); });
      socket.once("error", () => done(false));
    });
    if (available) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`Timed out waiting for port ${port}`);
}

async function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children.reverse()) {
    try { process.kill(-child.pid, "SIGTERM"); } catch { /* Already exited. */ }
  }
  await Promise.all(children.map((child) => new Promise((done) => {
    if (child.exitCode !== null) return done();
    child.once("exit", done);
    setTimeout(done, 3_000).unref();
  })));
  // The command exits before Nitro's graceful five-second shutdown finishes; do not
  // kill PostgreSQL underneath its still-closing pool connections.
  if (children.length) await new Promise((done) => setTimeout(done, 5_500));
  for (const child of children) {
    try { process.kill(-child.pid, "SIGKILL"); } catch { /* Process group has exited. */ }
  }
  if (containerStarted) spawnSync(runtime, ["stop", containerName], { stdio: "inherit" });
  process.exitCode = 0;
}

process.once("SIGINT", () => { void cleanup(); });
process.once("SIGTERM", () => { void cleanup(); });

try {
  console.log("[local] Starting isolated PostgreSQL and Firebase Auth Emulator");
  for (const port of [55440, 9099, 31017]) {
    const inUse = await new Promise((done) => {
      const socket = createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => { socket.destroy(); done(true); });
      socket.once("error", () => done(false));
    });
    if (inUse) throw new Error(`Port ${port} is already in use; refusing to reuse another service`);
  }
  const db = spawnSync(runtime, [
    "run", "--rm", "-d", "--name", containerName,
    "--publish", "127.0.0.1:55440:5432",
    "--env", "POSTGRES_USER=e2e", "--env", "POSTGRES_PASSWORD=e2e",
    "--env", "POSTGRES_DB=oscana_e2e", "docker.io/library/postgres:17-alpine",
  ], { cwd: root, stdio: "inherit" });
  if (db.status !== 0) throw new Error("Could not create the disposable PostgreSQL container (is port 55440 available?)");
  containerStarted = true;
  await waitForPort(55440);
  for (let attempt = 0; attempt < 30; attempt++) {
    const connection = new pg.Client({ connectionString: dbUrl, connectionTimeoutMillis: 2_000 });
    try { await connection.connect(); await connection.end(); break; }
    catch (error) {
      await connection.end().catch(() => {});
      if (attempt === 29) throw error;
      await new Promise((done) => setTimeout(done, 500));
    }
  }

  const safe = {
    ...process.env,
    OSCANA_E2E: "1",
    DATABASE_URL: dbUrl,
    DEPLOYED_ENV: "local",
    NODE_ENV: "development",
    FIREBASE_PROJECT_ID: "demo-oscana",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    FIREBASE_CLIENT_EMAIL: "",
    FIREBASE_PRIVATE_KEY: "",
    GOOGLE_APPLICATION_CREDENTIALS: "",
    GCLOUD_PROJECT: "",
    ADMIN_EMAILS: "ajstrongdev@pm.me",
    VITE_FIREBASE_AUTH_EMULATOR_URL: "http://127.0.0.1:9099",
    VITE_FIREBASE_PROJECT_ID: "demo-oscana",
    VITE_FIREBASE_API_KEY: "local-only",
    VITE_FIREBASE_AUTH_DOMAIN: "demo-oscana.firebaseapp.com",
    VITE_FIREBASE_STORAGE_BUCKET: "demo-oscana.appspot.com",
    VITE_FIREBASE_MESSAGING_SENDER_ID: "local-only",
    VITE_FIREBASE_APP_ID: "local-only",
    VITE_FIREBASE_MEASUREMENT_ID: "",
    VAPID_PUBLIC_KEY: "",
    VAPID_PRIVATE_KEY: "",
    VAPID_SUBJECT: "",
    SITE_URL: siteUrl,
    APP_BASE_URL: siteUrl,
    CRON_LOCAL_TOKEN: "isolated-vscode-only",
    CRON_INTERNAL_TOKEN: "isolated-vscode-only",
    CRON_SCHEDULER_TOKEN: "",
    GCP_PROJECT_ID: "",
    CLOUD_TASKS_LOCATION: "",
    ELECTION_TASK_QUEUE: "",
    ELECTION_TASK_SERVICE_ACCOUNT: "",
  };
  await run("node", ["scripts/e2e/check-env.mjs"], safe);
  if (!process.env.OSCANA_VPS_SSH) throw new Error("Set OSCANA_VPS_SSH to the authenticated VPS SSH destination before starting Oscana");
  await run("node", ["scripts/sync-vps-db.mjs", "--yes", "--container", containerName], {
    ...safe, OSCANA_VPS_SSH: process.env.OSCANA_VPS_SSH,
    OSCANA_VPS_ENV: process.env.OSCANA_VPS_ENV || "production",
    OSCANA_CONTAINER_RUNTIME: runtime,
  });
  const emulator = start("bunx", ["firebase", "emulators:start", "--only", "auth", "--project", "demo-oscana"], safe);
  await waitForPort(9099, emulator);
  await run("bun", ["run", "db:migrate"], safe);
  await run("node", ["scripts/e2e/seed-auth.mjs", "--auth-only"], safe);
  await run("bun", ["run", "build"], { ...safe, NODE_ENV: "production" });

  const appEnv = {
    ...safe,
    PORT: "31017",
    HOST: "127.0.0.1",
  };
  const app = start("node", [".output/server/index.mjs"], appEnv);
  await waitForPort(31017, app, 60_000);
  const health = await fetch(`${siteUrl}/api/health`);
  if (!health.ok) throw new Error(`Local app health returned ${health.status}`);
  if (!process.argv.includes("--check")) start("node", ["scripts/scheduler.mjs"], appEnv);
  console.log(`[local] Ready: ${siteUrl} — VPS production data in a disposable DB, Auth Emulator demo-oscana${process.argv.includes("--check") ? "" : ", local scheduler"}; Web Push disabled`);
  console.log("[local] Emulator login: ajstrongdev@pm.me / local-e2e-password (requires matching user in the restored DB). Stop this task to stop its database and services.");
  if (process.argv.includes("--check")) await cleanup();
} catch (error) {
  console.error("[local] Could not start the isolated stack", error);
  await cleanup();
  process.exitCode = 1;
}
