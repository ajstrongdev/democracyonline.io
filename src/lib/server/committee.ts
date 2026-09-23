import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { PolicyValue } from "@/lib/nation/catalog";
import { db } from "@/db";
import {
  billLockedPolicyEffects,
  billLockedStatEffects,
  bills,
  committeeAssessments,
  committeePolicyAssessments,
  committeeStatAssessments,
  nationPolicyDefinitions,
  nationPolicyValues,
  nationStatDefinitions,
  nations,
  users,
} from "@/db/schema";
import { POLICY_BY_KEY, isBillMutablePolicy } from "@/lib/nation/catalog";
import {
  aggregatePolicyValues,
  aggregateStatEffects,
  validatePolicyValue,
  validateStatAssessment,
} from "@/lib/nation/simulation";
import { userEmailEquals } from "@/lib/server/user-email";
import { authMiddleware, requireAuthMiddleware } from "@/middleware";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const assessmentSchema = z.object({
  billId: z.number().int().positive(),
  stats: z.array(
    z.object({
      statKey: z.string().min(1),
      effect: z.number().int().min(-2).max(2),
    }),
  ),
  policies: z.array(
    z.object({
      policyKey: z.string().min(1),
      value: z.union([z.boolean(), z.number(), z.string()]),
    }),
  ),
});

const BILL_STAGE_DURATION_MS = 8 * 60 * 60 * 1000;

export async function lockCommitteeOutcome(
  tx: Transaction,
  billId: number,
  now: Date = new Date(),
  stageDurationMs: number = BILL_STAGE_DURATION_MS,
) {
  const [bill] = await tx
    .select()
    .from(bills)
    .where(eq(bills.id, billId))
    .limit(1);
  if (!bill || bill.status !== "Committee")
    throw new Error("Bill is no longer in Senate Committee");

  const assessments = await tx
    .select({ id: committeeAssessments.id })
    .from(committeeAssessments)
    .where(eq(committeeAssessments.billId, billId));
  const assessmentIds = assessments.map(({ id }) => id);
  const statRows = assessmentIds.length
    ? await tx
        .select()
        .from(committeeStatAssessments)
        .where(inArray(committeeStatAssessments.assessmentId, assessmentIds))
    : [];
  const policyRows = assessmentIds.length
    ? await tx
        .select()
        .from(committeePolicyAssessments)
        .where(inArray(committeePolicyAssessments.assessmentId, assessmentIds))
    : [];

  const statValues = new Map<string, Array<number>>();
  for (const row of statRows)
    statValues.set(row.statKey, [
      ...(statValues.get(row.statKey) ?? []),
      row.effect,
    ]);
  if (statValues.size) {
    await tx.insert(billLockedStatEffects).values(
      [...statValues].map(([statKey, values]) => ({
        billId,
        statKey,
        effect: aggregateStatEffects(values),
      })),
    );
  }

  const [nation] = await tx.select({ id: nations.id }).from(nations).limit(1);
  const currentPolicies = nation
    ? await tx
        .select()
        .from(nationPolicyValues)
        .where(eq(nationPolicyValues.nationId, nation.id))
    : [];
  const currentByKey = new Map(
    currentPolicies.map((row) => [row.policyKey, row.value]),
  );
  const proposals = new Map<string, Array<PolicyValue>>();
  for (const row of policyRows) {
    if (!isBillMutablePolicy(row.policyKey)) continue;
    proposals.set(row.policyKey, [
      ...(proposals.get(row.policyKey) ?? []),
      row.proposedValue,
    ]);
  }
  const lockedPolicies = [...proposals].flatMap(([policyKey, values]) => {
    const previousValue = currentByKey.get(policyKey);
    if (previousValue === undefined) return [];
    const newValue = aggregatePolicyValues(values, previousValue);
    return JSON.stringify(newValue) === JSON.stringify(previousValue)
      ? []
      : [{ billId, policyKey, previousValue, newValue }];
  });
  if (lockedPolicies.length)
    await tx.insert(billLockedPolicyEffects).values(lockedPolicies);

  await tx
    .update(bills)
    .set({
      status: "Voting",
      committeeClosedAt: now,
      committeeParticipantCount: assessments.length,
      // A bill closed early from Committee must start a fresh voting
      // window (8h at regular speed, scaled by the game speed). Without this
      // it would retain the original Committee deadline and advance (or
      // stall) at the wrong time. See docs/BILL_HANDOVER.md.
      stageStartedAt: now,
      stageEndsAt: new Date(now.getTime() + stageDurationMs),
    })
    .where(and(eq(bills.id, billId), eq(bills.status, "Committee")));
}

async function queryCommitteeData(
  billId: number,
  currentUserId?: number,
  canAssess = false,
) {
  const [bill] = await db
    .select({
      status: bills.status,
      closedAt: bills.committeeClosedAt,
      participantCount: bills.committeeParticipantCount,
    })
    .from(bills)
    .where(eq(bills.id, billId))
    .limit(1);
  if (!bill) return null;
  const assessments = await db
    .select({
      id: committeeAssessments.id,
      senatorId: committeeAssessments.senatorId,
    })
    .from(committeeAssessments)
    .where(eq(committeeAssessments.billId, billId));
  const ids = assessments.map(({ id }) => id);
  const [
    liveStats,
    livePolicies,
    lockedStats,
    lockedPolicies,
    statDefinitions,
    policyDefinitions,
    nation,
    currentPolicies,
  ] = await Promise.all([
    ids.length
      ? db
          .select()
          .from(committeeStatAssessments)
          .where(inArray(committeeStatAssessments.assessmentId, ids))
      : [],
    ids.length
      ? db
          .select()
          .from(committeePolicyAssessments)
          .where(inArray(committeePolicyAssessments.assessmentId, ids))
      : [],
    db
      .select({
        key: billLockedStatEffects.statKey,
        effect: billLockedStatEffects.effect,
        name: nationStatDefinitions.name,
      })
      .from(billLockedStatEffects)
      .innerJoin(
        nationStatDefinitions,
        eq(billLockedStatEffects.statKey, nationStatDefinitions.key),
      )
      .where(eq(billLockedStatEffects.billId, billId)),
    db
      .select({
        key: billLockedPolicyEffects.policyKey,
        previousValue: billLockedPolicyEffects.previousValue,
        newValue: billLockedPolicyEffects.newValue,
        name: nationPolicyDefinitions.name,
      })
      .from(billLockedPolicyEffects)
      .innerJoin(
        nationPolicyDefinitions,
        eq(billLockedPolicyEffects.policyKey, nationPolicyDefinitions.key),
      )
      .where(eq(billLockedPolicyEffects.billId, billId)),
    db
      .select()
      .from(nationStatDefinitions)
      .orderBy(nationStatDefinitions.category, nationStatDefinitions.name),
    db
      .select()
      .from(nationPolicyDefinitions)
      .orderBy(nationPolicyDefinitions.category, nationPolicyDefinitions.name),
    db.select({ id: nations.id }).from(nations).limit(1),
    db.select().from(nationPolicyValues),
  ]);
  const statNames = new Map(
    statDefinitions.map((definition) => [definition.key, definition.name]),
  );
  const mutablePolicyDefinitions = policyDefinitions.filter((definition) =>
    isBillMutablePolicy(definition.key),
  );
  const policyNames = new Map(
    policyDefinitions.map((definition) => [definition.key, definition.name]),
  );
  const currentPolicyMap = new Map(
    currentPolicies.map((row) => [row.policyKey, row.value]),
  );
  const statGroups = new Map<string, Array<number>>();
  for (const row of liveStats)
    statGroups.set(row.statKey, [
      ...(statGroups.get(row.statKey) ?? []),
      row.effect,
    ]);
  const policyGroups = new Map<string, Array<PolicyValue>>();
  for (const row of livePolicies) {
    if (!isBillMutablePolicy(row.policyKey)) continue;
    policyGroups.set(row.policyKey, [
      ...(policyGroups.get(row.policyKey) ?? []),
      row.proposedValue,
    ]);
  }
  const own = assessments.find(
    (assessment) => assessment.senatorId === currentUserId,
  );
  return {
    status: bill.status,
    canAssess,
    closedAt: bill.closedAt,
    participantCount:
      bill.status === "Committee"
        ? assessments.length
        : (bill.participantCount ?? 0),
    stats:
      bill.status === "Committee"
        ? [...statGroups].map(([key, values]) => ({
            key,
            name: statNames.get(key) ?? key,
            effect: aggregateStatEffects(values),
          }))
        : lockedStats,
    policies:
      bill.status === "Committee"
        ? [...policyGroups].flatMap(([key, values]) => {
            const previousValue = currentPolicyMap.get(key);
            if (previousValue === undefined) return [];
            const newValue = aggregatePolicyValues(values, previousValue);
            return JSON.stringify(newValue) === JSON.stringify(previousValue)
              ? []
              : [
                  {
                    key,
                    name: policyNames.get(key) ?? key,
                    previousValue,
                    newValue,
                  },
                ];
          })
        : lockedPolicies.filter((effect) => isBillMutablePolicy(effect.key)),
    definitions: { stats: statDefinitions, policies: mutablePolicyDefinitions },
    currentPolicies: Object.fromEntries(currentPolicyMap),
    ownAssessment: own
      ? {
          stats: liveStats
            .filter((row) => row.assessmentId === own.id)
            .map(({ statKey, effect }) => ({ statKey, effect })),
          policies: livePolicies
            .filter(
              (row) =>
                row.assessmentId === own.id &&
                isBillMutablePolicy(row.policyKey),
            )
            .map(({ policyKey, proposedValue }) => ({
              policyKey,
              value: proposedValue,
            })),
        }
      : null,
    hasNation: Boolean(nation[0]),
  };
}

export const getCommitteeData = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(z.object({ billId: z.number().int().positive() }))
  .handler(async ({ data, context }) => {
    const [user] = context.user?.email
      ? await db
          .select({ id: users.id, role: users.role, active: users.isActive })
          .from(users)
          .where(userEmailEquals(context.user.email))
          .limit(1)
      : [];
    return queryCommitteeData(
      data.billId,
      user?.id,
      user?.role === "Senator" && Boolean(user.active),
    );
  });

export const saveCommitteeAssessment = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator(assessmentSchema)
  .handler(async ({ data, context }) => {
    if (!context.user?.email) throw new Error("Authentication required");
    const email = context.user.email;
    validateStatAssessment(data.stats);
    if (
      new Set(data.policies.map(({ policyKey }) => policyKey)).size !==
      data.policies.length
    )
      throw new Error("Each policy can only be proposed once");
    for (const proposal of data.policies) {
      if (!isBillMutablePolicy(proposal.policyKey))
        throw new Error(
          "This constitutional policy cannot be changed by a bill",
        );
      const definition = POLICY_BY_KEY.get(proposal.policyKey);
      if (!definition || !validatePolicyValue(definition, proposal.value))
        throw new Error("Invalid policy value");
    }
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select ${bills.id} from ${bills} where ${bills.id} = ${data.billId} for update`,
      );
      const [bill] = await tx
        .select({ status: bills.status })
        .from(bills)
        .where(eq(bills.id, data.billId))
        .limit(1);
      if (bill?.status !== "Committee")
        throw new Error("Senate Committee has closed for this bill");
      const [senator] = await tx
        .select({ id: users.id, role: users.role, active: users.isActive })
        .from(users)
        .where(userEmailEquals(email))
        .limit(1);
      if (!senator || senator.role !== "Senator" || !senator.active)
        throw new Error(
          "Only serving senators can submit Senate Committee assessments",
        );
      const [assessment] = await tx
        .insert(committeeAssessments)
        .values({ billId: data.billId, senatorId: senator.id })
        .onConflictDoUpdate({
          target: [committeeAssessments.billId, committeeAssessments.senatorId],
          set: { updatedAt: new Date() },
        })
        .returning({ id: committeeAssessments.id });
      await tx
        .delete(committeeStatAssessments)
        .where(eq(committeeStatAssessments.assessmentId, assessment.id));
      await tx
        .delete(committeePolicyAssessments)
        .where(eq(committeePolicyAssessments.assessmentId, assessment.id));
      if (data.stats.length)
        await tx.insert(committeeStatAssessments).values(
          data.stats.map((effect) => ({
            assessmentId: assessment.id,
            ...effect,
          })),
        );
      if (data.policies.length)
        await tx.insert(committeePolicyAssessments).values(
          data.policies.map((proposal) => ({
            assessmentId: assessment.id,
            policyKey: proposal.policyKey,
            proposedValue: proposal.value,
          })),
        );
      return { id: assessment.id };
    });
  });
