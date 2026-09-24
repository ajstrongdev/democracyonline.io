#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { loadEnvFile } from "node:process";
import pg from "pg";

const required = [
  "ADMIN_EMAILS",
  "APP_PORT",
  "COMPOSE_PROJECT_NAME",
  "CRON_INTERNAL_TOKEN",
  "DATABASE_URL",
  "DEPLOYED_ENV",
  "DOCKER_SUBNET",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_PROJECT_ID",
  "SITE_URL",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
];

const placeholders = [
  "...",
  "change-this",
  "example.com",
  "postgres:postgres",
  "your-",
];

// A checkout's .env is authoritative. Do not let credentials exported by a
// previous shell session make this checkout validate the wrong environment.
for (const key of [...required, "VITE_FIREBASE_MEASUREMENT_ID"]) {
  delete process.env[key];
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

try {
  loadEnvFile(".env");
} catch {
  console.error("ERROR: .env does not exist in the current checkout.");
  process.exit(1);
}

for (const key of required) {
  const value = process.env[key]?.trim();
  if (!value) {
    fail(`${key} is missing or empty`);
    continue;
  }
  if (
    placeholders.some((placeholder) =>
      value.toLowerCase().includes(placeholder),
    )
  ) {
    fail(`${key} still contains an example/placeholder value`);
  }
}

if (!new Set(["production", "development"]).has(process.env.DEPLOYED_ENV)) {
  fail("DEPLOYED_ENV must be production or development on the VPS");
}

if (!/^[a-z0-9][a-z0-9_-]*$/.test(process.env.COMPOSE_PROJECT_NAME ?? "")) {
  fail(
    "COMPOSE_PROJECT_NAME may only contain lowercase letters, digits, underscores, and hyphens",
  );
}

if (!/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(process.env.DOCKER_SUBNET ?? "")) {
  fail("DOCKER_SUBNET must be an IPv4 CIDR such as 172.30.0.0/24");
}

if ((process.env.CRON_INTERNAL_TOKEN?.length ?? 0) < 32) {
  fail("CRON_INTERNAL_TOKEN must be at least 32 characters");
}

if (
  !process.env.ADMIN_EMAILS?.split(",").every((email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
  )
) {
  fail("ADMIN_EMAILS must be a comma-separated list of valid email addresses");
}

const appPort = Number(process.env.APP_PORT);
if (!Number.isInteger(appPort) || appPort < 1 || appPort > 65535) {
  fail("APP_PORT must be an integer from 1 to 65535");
}

try {
  const site = new URL(process.env.SITE_URL);
  if (site.protocol !== "https:") fail("SITE_URL must use https on the VPS");
} catch {
  fail("SITE_URL is not a valid URL");
}

let databaseUrl;
try {
  databaseUrl = new URL(process.env.DATABASE_URL);
  if (!new Set(["postgres:", "postgresql:"]).has(databaseUrl.protocol)) {
    fail("DATABASE_URL must use postgresql:// or postgres://");
  }
  if (new Set(["localhost", "127.0.0.1", "::1"]).has(databaseUrl.hostname)) {
    fail("DATABASE_URL cannot use localhost from a Docker deployment");
  }
} catch {
  fail("DATABASE_URL is not a valid PostgreSQL URL");
}

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replaceAll("\\n", "\n");
if (
  privateKey &&
  (!privateKey.startsWith("-----BEGIN PRIVATE KEY-----\n") ||
    !privateKey.endsWith("-----END PRIVATE KEY-----\n"))
) {
  fail("FIREBASE_PRIVATE_KEY is not a complete PKCS#8 private key");
}

if (process.env.FIREBASE_PROJECT_ID !== process.env.VITE_FIREBASE_PROJECT_ID) {
  fail("FIREBASE_PROJECT_ID and VITE_FIREBASE_PROJECT_ID must match");
}

const compose = spawnSync(
  "docker",
  ["compose", "--env-file", ".env", "config", "--quiet"],
  { encoding: "utf8" },
);
if (compose.error) {
  fail(`could not run Docker Compose: ${compose.error.message}`);
} else if (compose.status !== 0) {
  fail(
    `Docker Compose configuration is invalid: ${compose.stderr?.trim() || "unknown error"}`,
  );
}

if (process.exitCode) process.exit(process.exitCode);

const client = new pg.Client({ connectionString: databaseUrl.toString() });
try {
  await client.connect();
  const result = await client.query(
    "select current_database() as database, current_user as role",
  );
  const row = result.rows[0];
  console.log(
    `OK: ${process.env.DEPLOYED_ENV} environment is valid; database authentication succeeded (${row.database} as ${row.role}).`,
  );
} catch (error) {
  fail(`database authentication failed: ${error.message}`);
} finally {
  await client.end().catch(() => {});
}

if (process.exitCode) process.exit(process.exitCode);
