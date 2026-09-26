import { createFileRoute } from "@tanstack/react-router";
import { OAuth2Client } from "google-auth-library";
import { env } from "@/env";
import { getAdminAuth } from "@/lib/firebase-admin";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import { advanceElectionLifecycle } from "@/lib/server/election-lifecycle";

const oAuth2Client = new OAuth2Client();

export const Route = createFileRoute("/api/election-advance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authorizeCronRequest({
          request,
          env,
          verifySchedulerIdToken: async ({ idToken, audience }) => {
            const ticket = await oAuth2Client.verifyIdToken({
              idToken,
              audience,
            });
            return { email: ticket.getPayload()?.email };
          },
          verifyAdminIdToken: async ({ idToken }) => {
            const decoded = await getAdminAuth().verifyIdToken(idToken);
            return { email: decoded.email };
          },
        });

        if (authFailure) return authFailure;

        try {
          await advanceElectionLifecycle();
          return Response.json({ success: true });
        } catch (error) {
          console.error("[election-advance] Lifecycle advance failed", error);
          return Response.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
