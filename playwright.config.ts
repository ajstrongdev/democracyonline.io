import { defineConfig, devices } from "@playwright/test";
import { assertIsolatedE2EEnvironment } from "./scripts/e2e/check-env.mjs";

assertIsolatedE2EEnvironment();

export default defineConfig({
  testDir: "./tests/e2e",
  // The tests share one disposable database and Auth Emulator instance.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:31017",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "PORT=31017 HOST=127.0.0.1 bun run start",
    url: "http://127.0.0.1:31017/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
