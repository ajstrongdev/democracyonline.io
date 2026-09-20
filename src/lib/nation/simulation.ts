import type {
  HeadlineKey,
  PolicyDefinition,
  PolicyValue,
  StatDefinition,
} from "./catalog";

export const MAX_ASSESSED_STATS = 5;
export const ASSESSMENT_IMPACT_BUDGET = 6;
export const STAT_EFFECT_SCALE = [-2, -1, 0, 1, 2] as const;
export type StatEffect = (typeof STAT_EFFECT_SCALE)[number];

export function validateStatAssessment(
  effects: Array<{ statKey: string; effect: number }>,
) {
  if (effects.length > MAX_ASSESSED_STATS) {
    throw new Error(`Choose no more than ${MAX_ASSESSED_STATS} statistics`);
  }
  if (
    new Set(effects.map((effect) => effect.statKey)).size !== effects.length
  ) {
    throw new Error("Each statistic can only be assessed once");
  }
  if (
    effects.some(
      ({ effect }) => !STAT_EFFECT_SCALE.includes(effect as StatEffect),
    )
  ) {
    throw new Error("Statistic effects must use the five-point scale");
  }
  if (
    effects.reduce((total, effect) => total + Math.abs(effect.effect), 0) >
    ASSESSMENT_IMPACT_BUDGET
  ) {
    throw new Error(
      "Focus the assessment on the bill's most important effects",
    );
  }
}

export function validatePolicyValue(
  definition: PolicyDefinition,
  value: unknown,
): value is PolicyValue {
  if (definition.type === "boolean") return typeof value === "boolean";
  if (definition.type === "enum") {
    return (
      typeof value === "string" && Boolean(definition.options?.includes(value))
    );
  }
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= (definition.min ?? -Infinity) &&
    value <= (definition.max ?? Infinity)
  );
}

export function aggregateStatEffects(values: Array<number>) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const trim =
    sorted.length >= 5 ? Math.max(1, Math.floor(sorted.length * 0.1)) : 0;
  const included = trim ? sorted.slice(trim, -trim) : sorted;
  return included.reduce((sum, value) => sum + value, 0) / included.length;
}

export function aggregatePolicyValues(
  values: Array<PolicyValue>,
  currentValue: PolicyValue,
) {
  if (!values.length) return currentValue;
  const counts = new Map<string, { value: PolicyValue; count: number }>();
  for (const value of values) {
    const key = JSON.stringify(value);
    const entry = counts.get(key);
    counts.set(key, { value, count: (entry?.count ?? 0) + 1 });
  }
  const ranked = [...counts.values()].sort(
    (left, right) => right.count - left.count,
  );
  return ranked.length > 1 && ranked[0].count === ranked[1].count
    ? currentValue
    : ranked[0].value;
}

export function applyDiminishingEffect(
  current: number,
  effect: number,
  min: number,
  max: number,
) {
  const range = max - min;
  if (range <= 0) return min;
  const room = effect >= 0 ? max - current : current - min;
  const multiplier = Math.max(0, Math.min(1, room / range));
  const next = current + effect * 5 * multiplier;
  return Math.max(min, Math.min(max, next));
}

export function calculateHeadlineIndices(
  definitions: Array<StatDefinition>,
  values: ReadonlyMap<string, number>,
): Record<HeadlineKey, number> {
  const result = {
    civil_rights: 50,
    economy: 50,
    political_freedoms: 50,
  } satisfies Record<HeadlineKey, number>;
  for (const headline of Object.keys(result) as Array<HeadlineKey>) {
    const contributors = definitions.filter(
      (definition) =>
        definition.headline === headline && definition.headlineWeight > 0,
    );
    const weight = contributors.reduce(
      (sum, definition) => sum + definition.headlineWeight,
      0,
    );
    if (!weight) continue;
    const score =
      contributors.reduce((sum, definition) => {
        const raw = values.get(definition.key) ?? definition.defaultValue;
        const normalized =
          ((raw - definition.min) / (definition.max - definition.min)) * 100;
        const directed =
          definition.headlineDirection === "negative"
            ? 100 - normalized
            : normalized;
        return sum + directed * definition.headlineWeight;
      }, 0) / weight;
    result[headline] = Math.max(0, Math.min(100, score));
  }
  return result;
}
