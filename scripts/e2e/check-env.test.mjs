import { describe, expect, it } from "vitest";
import { assertIsolatedE2EEnvironment } from "./check-env.mjs";

const safe = {
  DATABASE_URL: "postgresql://e2e:e2e@127.0.0.1:5432/oscana_e2e",
  DEPLOYED_ENV: "local",
  OSCANA_E2E: "1",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  VITE_FIREBASE_AUTH_EMULATOR_URL: "http://127.0.0.1:9099",
  FIREBASE_PROJECT_ID: "demo-oscana",
  VITE_FIREBASE_PROJECT_ID: "demo-oscana",
};

describe("E2E isolation", () => {
  it("accepts only an explicit local test database and emulator", () => {
    expect(() => assertIsolatedE2EEnvironment(safe)).not.toThrow();
    for (const change of [
      { DATABASE_URL: "postgresql://e2e:e2e@prod.example/oscana_e2e" },
      { DATABASE_URL: "postgresql://e2e:e2e@localhost:5432/oscana" },
      { DEPLOYED_ENV: "production" },
      { FIREBASE_AUTH_EMULATOR_HOST: "prod.example:9099" },
      { VITE_FIREBASE_PROJECT_ID: "production-project" },
      { FIREBASE_PROJECT_ID: "production-project" },
      { VITE_FIREBASE_AUTH_EMULATOR_URL: "https://prod.example" },
      { VAPID_PRIVATE_KEY: "production-key" },
    ]) {
      expect(() => assertIsolatedE2EEnvironment({ ...safe, ...change })).toThrow();
    }
  });
});
