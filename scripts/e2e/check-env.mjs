// Never use the repository's .env for E2E: it may contain production Firebase
// credentials. This gate must run before migrations, seeds, or browser startup.
export function assertIsolatedE2EEnvironment(env = process.env) {
  const database = new URL(env.DATABASE_URL ?? "postgres://invalid/invalid");
  const authHost = (env.FIREBASE_AUTH_EMULATOR_HOST ?? "").split(":")[0];
  const clientEmulator = new URL(env.VITE_FIREBASE_AUTH_EMULATOR_URL ?? "http://invalid");
  const localHosts = ["localhost", "127.0.0.1", "::1", "[::1]"];
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !localHosts.includes(database.hostname) ||
    database.pathname !== "/oscana_e2e" ||
    env.OSCANA_E2E !== "1" ||
    env.DEPLOYED_ENV !== "local" ||
    !localHosts.includes(authHost) ||
    clientEmulator.protocol !== "http:" ||
    !localHosts.includes(clientEmulator.hostname) ||
    env.FIREBASE_PROJECT_ID !== "demo-oscana" ||
    env.VITE_FIREBASE_PROJECT_ID !== "demo-oscana" ||
    env.VAPID_PUBLIC_KEY || env.VAPID_PRIVATE_KEY || env.VAPID_SUBJECT
  ) {
    throw new Error("E2E requires an isolated local oscana_e2e database, demo-oscana Auth emulator and Web Push disabled; refusing to start");
  }
}

if (process.argv[1]?.endsWith("check-env.mjs")) {
  assertIsolatedE2EEnvironment();
}
