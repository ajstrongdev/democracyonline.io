import { createFileRoute } from "@tanstack/react-router";
import { OAuth2Client } from "google-auth-library";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  billVotesHouse,
  billVotesPresidential,
  billVotesSenate,
  bills,
} from "@/db/schema";
import { archiveEmptyParties } from "@/lib/server/organization-lifecycle";
import { env } from "@/env";
import { getAdminAuth } from "@/lib/firebase-admin";
import { authorizeCronRequest } from "@/lib/server/cron-auth";
import { lockCommitteeOutcome } from "@/lib/server/committee";
import { applyPassedBillEffects } from "@/lib/server/bill-effects";

const oAuth2Client = new OAuth2Client();
const BILL_STAGE_DURATION_MS = 8 * 60 * 60 * 1000;

function nextStageDeadline(now: Date) {
  return new Date(now.getTime() + BILL_STAGE_DURATION_MS);
}

export const Route = createFileRoute("/api/bill-advance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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

        if (authFailure) {
          return authFailure;
        }

        try {
          await db.transaction(async (tx) => {
            await tx.execute(sql`select pg_advisory_xact_lock(24092026)`);
            const now = new Date();

            const getResult = async (
              table:
                | typeof billVotesHouse
                | typeof billVotesSenate
                | typeof billVotesPresidential,
              billId: number,
            ) => {
              const rows = await tx
                .select({
                  voteYes: table.voteYes,
                  count: sql<number>`count(*)::int`,
                })
                .from(table)
                .where(eq(table.billId, billId))
                .groupBy(table.voteYes);
              return {
                yes: rows.find((row) => row.voteYes)?.count ?? 0,
                no: rows.find((row) => !row.voteYes)?.count ?? 0,
              };
            };

            const presidential = await tx
              .select()
              .from(bills)
              .where(
                and(
                  eq(bills.stage, "Presidential"),
                  eq(bills.status, "Voting"),
                  lte(bills.stageEndsAt, now),
                ),
              );
            for (const bill of presidential) {
              const result = await getResult(billVotesPresidential, bill.id);
              const status = result.yes > result.no ? "Passed" : "Defeated";
              await tx
                .update(bills)
                .set({ status, stageStartedAt: now, stageEndsAt: null })
                .where(and(eq(bills.id, bill.id), eq(bills.status, "Voting")));
              if (status === "Passed")
                await applyPassedBillEffects(tx, bill.id);
            }

            const senate = await tx
              .select()
              .from(bills)
              .where(
                and(
                  eq(bills.stage, "Senate"),
                  eq(bills.status, "Voting"),
                  lte(bills.stageEndsAt, now),
                ),
              );
            for (const bill of senate) {
              const result = await getResult(billVotesSenate, bill.id);
              await tx
                .update(bills)
                .set(
                  result.yes > result.no
                    ? {
                      stage: "Presidential",
                      status: "Voting",
                      stageStartedAt: now,
                      stageEndsAt: nextStageDeadline(now),
                    }
                    : { status: "Defeated", stageStartedAt: now, stageEndsAt: null },
                )
                .where(and(eq(bills.id, bill.id), eq(bills.status, "Voting")));
            }

            const house = await tx
              .select()
              .from(bills)
              .where(
                and(
                  eq(bills.stage, "House"),
                  eq(bills.status, "Voting"),
                  lte(bills.stageEndsAt, now),
                ),
              );
            for (const bill of house) {
              const result = await getResult(billVotesHouse, bill.id);
              await tx
                .update(bills)
                .set(
                  result.yes > result.no
                    ? {
                      stage: "Senate",
                      status: "Voting",
                      stageStartedAt: now,
                      stageEndsAt: nextStageDeadline(now),
                    }
                    : { status: "Defeated", stageStartedAt: now, stageEndsAt: null },
                )
                .where(and(eq(bills.id, bill.id), eq(bills.status, "Voting")));
            }

            const committeeBills = await tx
              .select()
              .from(bills)
              .where(
                and(
                  eq(bills.stage, "House"),
                  eq(bills.status, "Committee"),
                  lte(bills.stageEndsAt, now),
                ),
              );
            for (const bill of committeeBills) {
              await lockCommitteeOutcome(tx, bill.id);
              await tx
                .update(bills)
                .set({ stageStartedAt: now, stageEndsAt: nextStageDeadline(now) })
                .where(eq(bills.id, bill.id));
            }
          });

          try {
            await db.transaction((tx) => archiveEmptyParties(tx));
          } catch (error) {
            console.error("Error archiving zero-member parties:", error);
          }

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error processing bill advance:", error);
          return new Response(
            JSON.stringify({
              success: false,
              error: "Internal Server Error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
