import { assertIsolatedE2EEnvironment } from "./check-env.mjs";
import pg from "pg";

assertIsolatedE2EEnvironment();
const database = new pg.Client({ connectionString: process.env.DATABASE_URL });
await database.connect();
try {
  // seed:fresh intentionally reuses social IDs on this disposable database.
  // Keep the new transactional outbox in step with that local-only reset.
  await database.query("TRUNCATE notification_outbox RESTART IDENTITY");
  await database.query(
    "insert into users (email, username, role, is_active) values ($1, $2, $3, true)",
    ["reader@oscana.test", "E2EReader", "Representative"],
  );
} finally {
  await database.end();
}

for (const email of ["ajstrongdev@pm.me", "reader@oscana.test"]) {
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=local-only`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "local-e2e-password", returnSecureToken: true }),
    },
  );
  if (!response.ok) throw new Error(`Could not seed Firebase Auth emulator (${response.status})`);
}
