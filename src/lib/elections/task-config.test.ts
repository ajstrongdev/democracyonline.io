import { describe, expect, it } from "vitest";
import { shouldScheduleElectionTask } from "./task-config";

const vps = {
  projectId: "",
  location: "",
  queue: "",
  serviceAccount: "",
  schedulerToken: "",
  internalToken: "vps-secret",
};

describe("election conclusion scheduling", () => {
  it("uses the VPS scheduler in production without requiring Google Cloud", () => {
    expect(shouldScheduleElectionTask(true, vps)).toBe(false);
  });

  it("requires a scheduler in production", () => {
    expect(() =>
      shouldScheduleElectionTask(true, { ...vps, internalToken: "" }),
    ).toThrow("Election scheduling needs");
  });

  it("rejects partial Cloud Tasks configuration instead of silently skipping it", () => {
    expect(() =>
      shouldScheduleElectionTask(true, { ...vps, projectId: "project" }),
    ).toThrow("Election task configuration is incomplete");
  });

  it("keeps non-production scheduling off", () => {
    expect(
      shouldScheduleElectionTask(false, { ...vps, projectId: "project" }),
    ).toBe(false);
  });

  it("enables fully configured Cloud Tasks", () => {
    expect(
      shouldScheduleElectionTask(true, {
        projectId: "project",
        location: "us-central1",
        queue: "queue",
        serviceAccount: "scheduler@example.com",
        schedulerToken: "secret",
        internalToken: "",
      }),
    ).toBe(true);
  });
});
