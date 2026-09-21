import { GoogleAuth } from "google-auth-library";
import { env } from "@/env";

type ElectionType = "President" | "Senate";

function taskId(election: ElectionType, cycle: number, deadline: Date) {
  return `${election.toLowerCase()}-${cycle}-${deadline.getTime()}`;
}

function isAlreadyExists(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "status" in error.response &&
    error.response.status === 409
  );
}

export async function ensureElectionConclusionTask({
  election,
  cycle,
  deadline,
}: {
  election: ElectionType;
  cycle: number;
  deadline: Date;
}) {
  if (env.NODE_ENV !== "production") return;

  const requiredConfig = {
    projectId: env.GCP_PROJECT_ID,
    location: env.CLOUD_TASKS_LOCATION,
    queue: env.ELECTION_TASK_QUEUE,
    serviceAccount: env.ELECTION_TASK_SERVICE_ACCOUNT,
    schedulerToken: env.CRON_SCHEDULER_TOKEN,
  };
  const missing = Object.entries(requiredConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(
      `Election task configuration is incomplete: ${missing.join(", ")}`,
    );
  }

  const parent = `projects/${requiredConfig.projectId}/locations/${requiredConfig.location}/queues/${requiredConfig.queue}`;
  const origin = new URL(env.SITE_URL).origin;
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  try {
    await auth.request({
      method: "POST",
      url: `https://cloudtasks.googleapis.com/v2/${parent}/tasks`,
      data: {
        task: {
          name: `${parent}/tasks/${taskId(election, cycle, deadline)}`,
          scheduleTime: deadline.toISOString(),
          httpRequest: {
            httpMethod: "POST",
            url: `${origin}/api/election-advance`,
            headers: {
              "Content-Type": "application/json",
              "x-scheduler-token": requiredConfig.schedulerToken,
            },
            body: Buffer.from(JSON.stringify({ election, cycle })).toString(
              "base64",
            ),
            oidcToken: {
              serviceAccountEmail: requiredConfig.serviceAccount,
              audience: origin,
            },
          },
        },
      },
    });
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
  }
}
