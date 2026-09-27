export type ElectionTaskConfig = {
  projectId: string;
  location: string;
  queue: string;
  serviceAccount: string;
  schedulerToken: string;
  internalToken: string;
};

/** Cloud Tasks is optional on the VPS, where the scheduler sidecar reconciles deadlines. */
export function shouldScheduleElectionTask(
  production: boolean,
  config: ElectionTaskConfig,
): boolean {
  if (!production) return false;
  const cloudValues = [
    config.projectId,
    config.location,
    config.queue,
    config.serviceAccount,
  ];
  if (cloudValues.every((value) => !value)) {
    if (config.internalToken) return false;
    throw new Error(
      "Election scheduling needs a VPS internal token or Cloud Tasks configuration",
    );
  }
  const missing = Object.entries(config)
    .filter(([key, value]) => key !== "internalToken" && !value)
    .map(([key]) => key);
  if (missing.length)
    throw new Error(
      `Election task configuration is incomplete: ${missing.join(", ")}`,
    );
  return true;
}
