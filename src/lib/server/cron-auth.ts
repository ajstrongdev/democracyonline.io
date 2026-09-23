export type CronAuthEnv = {
  NODE_ENV: "development" | "production" | "test";
  SITE_URL: string;
  CRON_SCHEDULER_TOKEN: string;
  CRON_LOCAL_TOKEN: string;
  CRON_INTERNAL_TOKEN?: string;
  ADMIN_EMAILS?: Array<string>;
};

type VerifySchedulerIdToken = (args: {
  idToken: string;
  audience: string;
}) => Promise<{ email?: string | null }>;

type VerifyAdminIdToken = (args: {
  idToken: string;
}) => Promise<{ email?: string | null }>;

const jsonHeaders = { "Content-Type": "application/json" };

const unauthorized = (error: string, status = 401) =>
  new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: jsonHeaders,
  });

export function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}

export async function authorizeCronRequest({
  request,
  env,
}: {
  request: Request;
  env: CronAuthEnv;
  verifySchedulerIdToken?: VerifySchedulerIdToken;
  verifyAdminIdToken?: VerifyAdminIdToken;
}): Promise<Response | null> {
  const requestHostname = new URL(request.url).hostname;
  const schedulerToken = request.headers.get("x-scheduler-token");
  const internalToken = request.headers.get("x-internal-cron-token");

  if (
    requestHostname === "app" &&
    env.CRON_INTERNAL_TOKEN &&
    (internalToken === env.CRON_INTERNAL_TOKEN ||
      schedulerToken === env.CRON_INTERNAL_TOKEN)
  ) {
    return null;
  }

  if (
    isLocalHostname(requestHostname) &&
    env.CRON_LOCAL_TOKEN &&
    (internalToken === env.CRON_LOCAL_TOKEN ||
      schedulerToken === env.CRON_LOCAL_TOKEN)
  ) {
    return null;
  }

  if (
    env.CRON_SCHEDULER_TOKEN &&
    (internalToken === env.CRON_SCHEDULER_TOKEN ||
      schedulerToken === env.CRON_SCHEDULER_TOKEN)
  ) {
    return null;
  }

  return unauthorized("Unauthorized");
}
