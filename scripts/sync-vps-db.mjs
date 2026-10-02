#!/usr/bin/env node
// Copy a fresh VPS production backup to a loopback-only local database.
import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, statSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
if (has("--help")) {
  console.log(
    "Usage: node scripts/sync-vps-db.mjs [--yes] [--dry-run] [--container NAME]\nCopies a fresh VPS production pg_dump into a local database. Set OSCANA_VPS_SSH in .env or your shell; --container requires it in the environment. Otherwise DATABASE_URL from .env is used. Backups are retained under tmp/vps-backups/.",
  );
  process.exit(0);
}
const containerIndex = args.indexOf("--container");
if (
  args.some(
    (arg, i) =>
      !["--yes", "--dry-run"].includes(arg) &&
      !(arg === "--container" && i === containerIndex) &&
      !(containerIndex !== -1 && i === containerIndex + 1),
  ) ||
  (containerIndex !== -1 && !args[containerIndex + 1])
) {
  throw new Error("Unknown or missing option; use --help");
}
const container = containerIndex === -1 ? null : args[containerIndex + 1];
if (container && !/^oscana-vscode-[0-9]+$/.test(container))
  throw new Error("Only the disposable Oscana container is allowed");
// The isolated stack supplies its own safe environment; never load the app's .env there.
if (!container) process.loadEnvFile(resolve(root, ".env"));
const host = process.env.OSCANA_VPS_SSH;
if (!host || !/^[a-zA-Z0-9_.@-]+$/.test(host) || host.startsWith("-")) {
  throw new Error(
    "Set OSCANA_VPS_SSH to your authenticated SSH destination (e.g. deploy@vps-alias)",
  );
}
const source = process.env.OSCANA_VPS_ENV ?? "production";
if (!["development", "production"].includes(source))
  throw new Error("Invalid OSCANA_VPS_ENV");
const checkout = source === "production" ? "prod" : "dev";

const url = new URL(
  container
    ? "postgresql://e2e:e2e@127.0.0.1:55440/oscana_e2e"
    : (process.env.DATABASE_URL ?? ""),
);
if (
  !["postgres:", "postgresql:"].includes(url.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
  !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(decodeURIComponent(url.pathname.slice(1))) ||
  url.search ||
  url.hash
) {
  throw new Error(
    "Target must be a simple PostgreSQL URL on loopback; refusing a remote database",
  );
}
const database = decodeURIComponent(url.pathname.slice(1));
if (
  ["template0", "template1"].includes(database) ||
  (!container && database === "oscana_e2e")
) {
  throw new Error("Refusing this target database");
}
const target = `${url.hostname}:${url.port || "5432"}/${database}`;
if (!has("--yes") && !has("--dry-run")) {
  throw new Error(
    `This replaces ALL data in ${target}. Pass --yes to confirm (or --dry-run to inspect).`,
  );
}
let localRuntime = null;
if (!container && !has("--dry-run")) {
  const probe = new pg.Client({ connectionString: url.toString() });
  await probe.connect();
  try {
    const result = await probe.query("SHOW server_version_num");
    if (Number(result.rows[0].server_version_num) < 170000) {
      throw new Error(
        "Local PostgreSQL must be version 17 or newer to restore a VPS PostgreSQL 17 backup; no databases were changed",
      );
    }
  } finally {
    await probe.end();
  }
  // The local VS Code database launcher uses my-postgres rather than host pg tools.
  // Only use its binaries when that container publishes the exact target port.
  for (const runtime of ["podman", "docker"]) {
    const result = spawnSync(
      runtime,
      [
        "inspect",
        "--format",
        "{{json .HostConfig.PortBindings}}",
        "my-postgres",
      ],
      { encoding: "utf8" },
    );
    if (result.status !== 0) continue;
    const bindings = JSON.parse(result.stdout)["5432/tcp"] ?? [];
    if (
      bindings.some(
        (binding) =>
          binding.HostPort === (url.port || "5432") &&
          ["0.0.0.0", "127.0.0.1", "", "::"].includes(binding.HostIp),
      )
    ) {
      localRuntime = runtime;
      break;
    }
  }
  if (!localRuntime) {
    for (const command of ["pg_dump", "pg_restore"]) {
      const result = spawnSync("which", [command], { stdio: "ignore" });
      if (result.status !== 0)
        throw new Error(
          `${command} is required unless the local DB runs in a my-postgres Podman/Docker container`,
        );
    }
  }
}
console.log(
  `Source: VPS ${source} via ${host}; target: local ${target}${container ? ` (${container})` : ""}`,
);
if (has("--dry-run")) {
  console.log(
    "Would create a fresh remote backup, copy it to tmp/vps-backups/, back up the local DB (if persistent), and replace the local DB.",
  );
  process.exit(0);
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${command} failed (${result.status}): ${result.stderr?.trim() || "see output above"}`,
    );
  return result.stdout;
}
const backups = resolve(root, "tmp/vps-backups");
mkdirSync(backups, { recursive: true, mode: 0o700 });
const stamp = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\..*/, "Z");
const remote = run("ssh", [
  "-o",
  "BatchMode=yes",
  host,
  `cd /srv/democracyonline-${checkout} && bash scripts/vps.sh backup`,
]);
const match = remote.match(
  /^Backup: (\/srv\/democracyonline-backups\/(?:development|production)\/([0-9]{8}T[0-9]{6}Z\.dump))$/m,
);
if (!match || !match[1].includes(`/${source}/`))
  throw new Error("Remote backup did not report a valid archive path");
const archive = resolve(backups, `${source}-${stamp}-${match[2]}`);
// Reserve the destination so no existing backup is silently overwritten.
const fd = openSync(archive, "wx", 0o600);
closeSync(fd);
try {
  run("scp", ["-q", "-o", "BatchMode=yes", `${host}:${match[1]}`, archive]);
  if (!statSync(archive).size) throw new Error("Downloaded backup is empty");
} catch (error) {
  // Leave the partial download for inspection; never restore it.
  throw new Error(`Backup copy failed; inspect ${archive}: ${error.message}`);
}
console.log(`VPS backup copied to ${archive}`);

if (container) {
  // This container is created empty by full-stack.mjs; no existing local data is touched.
  const input = openSync(archive, "r");
  try {
    run(
      process.env.OSCANA_CONTAINER_RUNTIME || "docker",
      [
        "exec",
        "-i",
        container,
        "pg_restore",
        "-U",
        "e2e",
        "-d",
        "oscana_e2e",
        "--no-owner",
        "--no-acl",
        "--exit-on-error",
      ],
      { stdio: [input, "inherit", "inherit"] },
    );
  } finally {
    closeSync(input);
  }
} else {
  const pgEnv = {
    ...process.env,
    PGHOST: url.hostname.replace(/^\[|\]$/g, ""),
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: database,
  };
  const localCopy = resolve(backups, `local-before-${stamp}.dump`);
  const output = openSync(localCopy, "wx", 0o600);
  try {
    if (localRuntime) {
      run(
        localRuntime,
        [
          "exec",
          "my-postgres",
          "pg_dump",
          "-U",
          pgEnv.PGUSER,
          "-d",
          database,
          "--format=custom",
        ],
        { stdio: ["ignore", output, "inherit"] },
      );
    } else {
      run("pg_dump", ["--format=custom", "--file", localCopy], { env: pgEnv });
    }
  } finally {
    closeSync(output);
  }
  if (!statSync(localCopy).size)
    throw new Error("Local backup is empty; refusing to replace the database");
  console.log(`Local backup saved to ${localCopy}`);
  const adminUrl = new URL(url);
  // template1 stays available even when the local target is the default "postgres" DB.
  adminUrl.pathname = "/template1";
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${database}"`);
  } finally {
    await admin.end();
  }
  if (localRuntime) {
    const input = openSync(archive, "r");
    try {
      run(
        localRuntime,
        [
          "exec",
          "-i",
          "my-postgres",
          "pg_restore",
          "-U",
          pgEnv.PGUSER,
          "-d",
          database,
          "--no-owner",
          "--no-acl",
          "--exit-on-error",
        ],
        { stdio: [input, "inherit", "inherit"] },
      );
    } finally {
      closeSync(input);
    }
  } else {
    run(
      "pg_restore",
      [
        "--no-owner",
        "--no-acl",
        "--exit-on-error",
        "--dbname",
        database,
        archive,
      ],
      { env: pgEnv },
    );
  }
}
console.log(
  `Restored VPS ${source} into local ${target}. Firebase Auth identities are NOT copied.`,
);
