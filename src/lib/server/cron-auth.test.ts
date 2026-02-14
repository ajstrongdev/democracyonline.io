import { describe, expect, it, vi } from "vitest";
import { authorizeCronRequest } from "@/lib/server/cron-auth";

const defaultEnv = {
  NODE_ENV: "development" as const,
  SITE_URL: "https://democracyonline.io",
  CRON_SCHEDULER_TOKEN: "prod-token",
  CRON_LOCAL_TOKEN: "local-token",
};

describe("authorizeCronRequest", () => {
  it("rejects non-local requests without scheduler token", async () => {
    const request = new Request("https://democracyonline.io/api/hourly-advance");

    const result = await authorizeCronRequest({
      request,
      env: defaultEnv,
      verifySchedulerIdToken: vi.fn(),
    });

    expect(result?.status).toBe(401);
  });

  it("rejects non-local requests without bearer auth", async () => {
    const request = new Request("https://democracyonline.io/api/hourly-advance", {
      headers: {
        "x-scheduler-token": "prod-token",
      },
    });

    const result = await authorizeCronRequest({
      request,
      env: defaultEnv,
      verifySchedulerIdToken: vi.fn(),
    });

    expect(result?.status).toBe(401);
  });

  it("accepts non-local requests with valid scheduler token and service account", async () => {
    const request = new Request("https://democracyonline.io/api/hourly-advance", {
      headers: {
        "x-scheduler-token": "prod-token",
        authorization: "Bearer valid-token",
      },
    });

    const result = await authorizeCronRequest({
      request,
      env: defaultEnv,
      verifySchedulerIdToken: vi.fn(async () => ({
        email: "finance-scheduler@proj.iam.gserviceaccount.com",
      })),
    });

    expect(result).toBeNull();
  });

  it("accepts local non-production requests with local scheduler token only", async () => {
    const request = new Request("http://localhost:3000/api/hourly-advance", {
      headers: {
        "x-scheduler-token": "local-token",
      },
    });

    const verifySchedulerIdToken = vi.fn();

    const result = await authorizeCronRequest({
      request,
      env: defaultEnv,
      verifySchedulerIdToken,
    });

    expect(result).toBeNull();
    expect(verifySchedulerIdToken).not.toHaveBeenCalled();
  });

  it("rejects local non-production requests with invalid local token", async () => {
    const request = new Request("http://127.0.0.1:3000/api/game-advance", {
      headers: {
        "x-scheduler-token": "wrong-token",
      },
    });

    const result = await authorizeCronRequest({
      request,
      env: defaultEnv,
      verifySchedulerIdToken: vi.fn(),
    });

    expect(result?.status).toBe(401);
  });

  it("requires non-local auth model in production even on localhost", async () => {
    const request = new Request("http://localhost:3000/api/hourly-advance", {
      headers: {
        "x-scheduler-token": "local-token",
      },
    });

    const result = await authorizeCronRequest({
      request,
      env: {
        ...defaultEnv,
        NODE_ENV: "production",
      },
      verifySchedulerIdToken: vi.fn(),
    });

    expect(result?.status).toBe(401);
  });
});
