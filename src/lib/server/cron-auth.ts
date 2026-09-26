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

const SCHEDULER_EMAIL_PATTERN = /-scheduler@.*\.iam\.gserviceaccount\.com$/;

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

function isAdminEmail(email: string, adminEmails: Array<string>) {
  return adminEmails.some(
    (adminEmail) => adminEmail.toLowerCase() === email.toLowerCase(),
  );
}

export async function authorizeCronRequest({
  request,
  env,
  verifySchedulerIdToken,
  verifyAdminIdToken,
}: {
  request: Request;
  env: CronAuthEnv;
  verifySchedulerIdToken?: VerifySchedulerIdToken;
  verifyAdminIdToken?: VerifyAdminIdToken;
}): Promise<Response | null> {
  const requestHostname = new URL(request.url).hostname;
  const schedulerToken = request.headers.get("x-scheduler-token");
  const internalToken = request.headers.get("x-internal-cron-token");

  // 1. Docker sidecar: app -> app over the Compose network.
  // Accepts either header name carrying CRON_INTERNAL_TOKEN so the
  // scheduler loop keeps working after renames.
  if (
    requestHostname === "app" &&
    env.CRON_INTERNAL_TOKEN &&
    (internalToken === env.CRON_INTERNAL_TOKEN ||
      schedulerToken === env.CRON_INTERNAL_TOKEN)
  ) {
    return null;
  }

  const adminTrigger = request.headers.get("x-admin-cron-trigger") === "1";
  const authHeader = request.headers.get("authorization");
  const isLocalNonProd =
    isLocalRequest(request) && env.NODE_ENV !== "production";

  // 2. Admin manual trigger from /admin (Firebase ID token + allowlist).
  if (adminTrigger) {
    if (!authHeader?.startsWith("Bearer ")) {
      return unauthorized("Unauthorized");
    }

    if (!verifyAdminIdToken) {
      console.error("verifyAdminIdToken not configured for admin cron access");
      return unauthorized("Cron auth misconfigured", 500);
    }

    const token = authHeader.slice(7);

    try {
      const payload = await verifyAdminIdToken({ idToken: token });
      const email = payload.email;
      const adminEmails = env.ADMIN_EMAILS ?? [];

      if (!email || !isAdminEmail(email, adminEmails)) {
        return unauthorized("Unauthorized", 403);
      }

      return null;
    } catch (error) {
      console.error("Admin token verification failed", error);
      return unauthorized("Unauthorized");
    }
  }

  // 3. Local non-prod: token only, no OIDC. Accept either header name.
  if (isLocalNonProd) {
    if (!env.CRON_LOCAL_TOKEN) {
      console.error("CRON_LOCAL_TOKEN not configured for local cron access");
      return unauthorized("Cron auth misconfigured", 500);
    }

    if (
      schedulerToken !== env.CRON_LOCAL_TOKEN &&
      internalToken !== env.CRON_LOCAL_TOKEN
    ) {
      return unauthorized("Unauthorized");
    }

    return null;
  }

  // 4. VPS sidecar via any hostname: internal token alone is sufficient.
  // This covers http://app:3000 (path 1 already handled it) plus public-URL
  // or misconfigured-Host calls carrying the same secret. No OIDC needed.
  if (
    env.CRON_INTERNAL_TOKEN &&
    (internalToken === env.CRON_INTERNAL_TOKEN ||
      schedulerToken === env.CRON_INTERNAL_TOKEN)
  ) {
    return null;
  }

  // 5. GCP Cloud Scheduler path: shared token + OIDC service-account check.
  // The token alone is NOT sufficient when a verifier is configured, which
  // preserves the tested auth model (see cron-auth.test.ts).
  const schedulerTokenValid =
    (!!schedulerToken && schedulerToken === env.CRON_SCHEDULER_TOKEN) ||
    (!!internalToken && internalToken === env.CRON_SCHEDULER_TOKEN);

  if (!schedulerTokenValid) {
    if (!env.CRON_SCHEDULER_TOKEN && !env.CRON_INTERNAL_TOKEN) {
      console.error("No cron scheduler token configured");
      return unauthorized("Cron auth misconfigured", 500);
    }
    return unauthorized("Unauthorized");
  }

  // VPS-only deploys with no OIDC verifier: token alone is sufficient.
  if (!verifySchedulerIdToken) {
    return null;
  }

  if (!authHeader?.startsWith("Bearer ")) {
    // Strict GCP path requires OIDC. VPS-only callers configure the routes
    // without a verifier (or rely on the sidecar hostname path above).
    // If a verifier IS configured, enforce it to preserve the tested
    // Cloud Scheduler auth model.
    return unauthorized("Unauthorized");
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifySchedulerIdToken({
      idToken: token,
      audience: new URL(request.url).origin,
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
