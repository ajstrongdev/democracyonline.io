import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bills,
  nationChanges,
  nationPolicyDefinitions,
  nationPolicyValues,
  nationStatDefinitions,
  nationStatValues,
  nations,
} from "@/db/schema";
import { FIXED_POLICY_VALUES } from "@/lib/nation/catalog";

export const getNationOverview = createServerFn().handler(async () => {
  const [nation] = await db.select().from(nations).limit(1);
  if (!nation) return null;
  const [stats, policies, recentChanges] = await Promise.all([
    db
      .select({
        key: nationStatDefinitions.key,
        name: nationStatDefinitions.name,
        category: nationStatDefinitions.category,
        value: nationStatValues.value,
      })
      .from(nationStatValues)
      .innerJoin(
        nationStatDefinitions,
        eq(nationStatValues.statKey, nationStatDefinitions.key),
      )
      .where(eq(nationStatValues.nationId, nation.id))
      .orderBy(nationStatDefinitions.category, nationStatDefinitions.name),
    db
      .select({
        key: nationPolicyDefinitions.key,
        name: nationPolicyDefinitions.name,
        category: nationPolicyDefinitions.category,
        type: nationPolicyDefinitions.type,
        value: nationPolicyValues.value,
      })
      .from(nationPolicyValues)
      .innerJoin(
        nationPolicyDefinitions,
        eq(nationPolicyValues.policyKey, nationPolicyDefinitions.key),
      )
      .where(eq(nationPolicyValues.nationId, nation.id))
      .orderBy(nationPolicyDefinitions.category, nationPolicyDefinitions.name),
    db
      .select({
        id: nationChanges.id,
        kind: nationChanges.kind,
        key: nationChanges.key,
        previousValue: nationChanges.previousValue,
        newValue: nationChanges.newValue,
        createdAt: nationChanges.createdAt,
        billId: bills.id,
        billTitle: bills.title,
      })
      .from(nationChanges)
      .innerJoin(bills, eq(nationChanges.billId, bills.id))
      .where(eq(nationChanges.nationId, nation.id))
      .orderBy(desc(nationChanges.createdAt))
      .limit(12),
  ]);
  const names = new Map(
    [...stats, ...policies].map((record) => [record.key, record.name]),
  );
  return {
    nation,
    stats,
    policies: policies.map((policy) => ({
      ...policy,
      value: FIXED_POLICY_VALUES[policy.key] ?? policy.value,
    })),
    recentChanges: recentChanges.map((change) => ({
      ...change,
      name: names.get(change.key) ?? change.key,
    })),
  };
});
