const SCHEDULER_EMAIL_PATTERN = /-scheduler@.*\.iam\.gserviceaccount\.com$/;

export type CronAuthEnv = {
  NODE_ENV: "development" | "production" | "test";
  SITE_URL: string;
  CRON_SCHEDULER_TOKEN: string;
  CRON_LOCAL_TOKEN: string;
};

type VerifySchedulerIdToken = (args: {
  idToken: string;
  audience: string;
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

function isLocalRequest(request: Request) {
  const host = new URL(request.url).hostname;
  return isLocalHostname(host);
}

export async function authorizeCronRequest({
  request,
  env,
  verifySchedulerIdToken,
}: {
  request: Request;
  env: CronAuthEnv;
  verifySchedulerIdToken: VerifySchedulerIdToken;
}): Promise<Response | null> {
  const schedulerToken = request.headers.get("x-scheduler-token");
  const isLocalNonProd =
    isLocalRequest(request) && env.NODE_ENV !== "production";

  if (isLocalNonProd) {
    if (!env.CRON_LOCAL_TOKEN) {
      console.error("CRON_LOCAL_TOKEN not configured for local cron access");
      return unauthorized("Cron auth misconfigured", 500);
    }

    if (schedulerToken !== env.CRON_LOCAL_TOKEN) {
      return unauthorized("Unauthorized");
    }

    return null;
  }

  if (!env.CRON_SCHEDULER_TOKEN) {
    console.error("CRON_SCHEDULER_TOKEN not configured");
    return unauthorized("Cron auth misconfigured", 500);
  }

  if (schedulerToken !== env.CRON_SCHEDULER_TOKEN) {
    return unauthorized("Unauthorized");
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return unauthorized("Unauthorized");
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifySchedulerIdToken({
      idToken: token,
      audience: env.SITE_URL,
    });

    if (!payload.email || !SCHEDULER_EMAIL_PATTERN.test(payload.email)) {
      return unauthorized("Unauthorized - Invalid service account", 403);
    }

    return null;
  } catch (error) {
    console.error("Scheduler token verification failed", error);
    return unauthorized("Unauthorized");
  }
}
