import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    IS_DEV: z
      .string()
      .default("false")
      .transform((val) => val === "true"),
    ADMIN_EMAILS: z
      .string()
      .optional()
      .default("")
      .transform((val) =>
        val
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean),
      ),
    DATABASE_URL: z.url(),
    FIREBASE_CLIENT_EMAIL: z.email().endsWith("iam.gserviceaccount.com"),
    FIREBASE_PRIVATE_KEY: z
      .string()
      .transform((key) => key.replaceAll(/\\n/gm, "\n"))
      .refine((key) => key.startsWith("-----BEGIN PRIVATE KEY-----\n"), {
        message:
          "FIREBASE_PRIVATE_KEY must start with '-----BEGIN PRIVATE KEY-----'",
      })
      .refine((key) => key.endsWith("-----END PRIVATE KEY-----\n"), {
        message:
          "FIREBASE_PRIVATE_KEY must end with '-----END PRIVATE KEY-----'",
      }),
    FIREBASE_PROJECT_ID: z.string().min(1),
    SITE_URL: z.url().default("http://localhost:3000"),
    CRON_SCHEDULER_TOKEN: z.string().optional().default(""),
    CRON_LOCAL_TOKEN: z.string().optional().default(""),
  },

  /**
   * The prefix that client-side variables must have. This is enforced both at
   * a type-level and at runtime.
   */
  clientPrefix: "VITE_",

  client: {
    VITE_FIREBASE_API_KEY: z.string().min(1),
    VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
    VITE_FIREBASE_PROJECT_ID: z.string().min(1),
    VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1),
    VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
    VITE_FIREBASE_APP_ID: z.string().min(1),
    VITE_FIREBASE_MEASUREMENT_ID: z.string().optional(),
  },

  /**
   * What object holds the environment variables at runtime. This is usually
   * `process.env` or `import.meta.env`.
   */
  runtimeEnv: {
    // Server-side variables from process.env
    NODE_ENV: process.env.NODE_ENV,
    IS_DEV: process.env.IS_DEV,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    DATABASE_URL: process.env.DATABASE_URL,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    SITE_URL: process.env.SITE_URL,
    CRON_SCHEDULER_TOKEN: process.env.CRON_SCHEDULER_TOKEN,
    CRON_LOCAL_TOKEN: process.env.CRON_LOCAL_TOKEN,
    // Client-side variables from import.meta.env
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env
      .VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
    VITE_FIREBASE_MEASUREMENT_ID: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  },

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,

  onValidationError: (issues) => {
    console.error(
      "❌ Invalid environment variables:",
      JSON.stringify(issues, null, 2),
    );
    throw new Error("Invalid environment variables");
  },
});
