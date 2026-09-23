import { useState, useTransition } from "react";
import { Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";
import type { PolicyValue } from "@/lib/nation/catalog";
import type { getCommitteeData } from "@/lib/server/committee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WikiEmpty, WikiSection } from "@/components/wiki/wiki-layout";
import { formatPolicyValue, isBillMutablePolicy } from "@/lib/nation/catalog";
import { ASSESSMENT_IMPACT_BUDGET } from "@/lib/nation/simulation";
import { saveCommitteeAssessment } from "@/lib/server/committee";

type CommitteeData = NonNullable<Awaited<ReturnType<typeof getCommitteeData>>>;
const effectChoices = [
  [-2, "Large decrease"],
  [-1, "Small decrease"],
  [0, "No meaningful change"],
  [1, "Small increase"],
  [2, "Large increase"],
] as const;

export function CommitteeOutcome({
  billId,
  data,
}: {
  billId: number;
  data: CommitteeData;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [statQuery, setStatQuery] = useState("");
  const [policyQuery, setPolicyQuery] = useState("");
  const [statCategory, setStatCategory] = useState("all");
  const [policyCategory, setPolicyCategory] = useState("all");
  const [selectedStat, setSelectedStat] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState("");
  const [stats, setStats] = useState(data.ownAssessment?.stats ?? []);
  const [policies, setPolicies] = useState(
    data.ownAssessment?.policies.filter(({ policyKey }) =>
      isBillMutablePolicy(policyKey),
    ) ?? [],
  );
  const usedImpact = stats.reduce(
    (total, effect) => total + Math.abs(effect.effect),
    0,
  );
  const save = () =>
    startTransition(async () => {
      try {
        await saveCommitteeAssessment({ data: { billId, stats, policies } });
        toast.success("Senate Committee assessment saved");
        setEditing(false);
        await router.invalidate();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not save assessment",
        );
      }
    });

  return (
    <WikiSection
      title={
        data.status === "Committee"
          ? "Senate Committee"
          : "Senate Committee outcome"
      }
      description={
        data.status === "Committee"
          ? "The Senate Committee defines what this bill would change. Voting decides whether it happens."
          : "These consequences were frozen when the bill entered voting."
      }
      aside={
        data.status === "Committee" && data.canAssess && !editing ? (
          <Button size="sm" onClick={() => setEditing(true)}>
            {data.ownAssessment ? "Edit your assessment" : "Add assessment"}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {!data.stats.length && !data.policies.length ? (
          <WikiEmpty>
            {data.status === "Committee"
              ? "No Senate Committee assessments yet. Senators can assess what this bill would change."
              : "No Senate Committee effects were submitted."}
          </WikiEmpty>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-serif font-semibold">
                Projected effects
              </h3>
              <div className="divide-y border-y">
                {data.stats.map((effect) => (
                  <div
                    key={effect.key}
                    className="flex justify-between gap-3 py-2 text-sm"
                  >
                    <span>{effect.name}</span>
                    <strong className="font-mono">
                      {effect.effect > 0 ? "+" : ""}
                      {effect.effect.toFixed(1)}
                    </strong>
                  </div>
                ))}
                {!data.stats.length && (
                  <p className="py-3 text-sm text-muted-foreground">
                    No statistic changes.
                  </p>
                )}
              </div>
            </div>
            <div>
              <h3 className="mb-2 font-serif font-semibold">Policy changes</h3>
              <div className="divide-y border-y">
                {data.policies.map((effect) => (
                  <div key={effect.key} className="py-2 text-sm">
                    <p className="font-medium">{effect.name}</p>
                    <p className="text-muted-foreground">
                      {formatPolicyValue(effect.previousValue)} →{" "}
                      {formatPolicyValue(effect.newValue)}
                    </p>
                  </div>
                ))}
                {!data.policies.length && (
                  <p className="py-3 text-sm text-muted-foreground">
                    No policy changes.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        <p className="font-mono text-xs text-muted-foreground">
          Based on {data.participantCount} Senate Committee{" "}
          {data.participantCount === 1 ? "assessment" : "assessments"}
          {data.closedAt ? " · Senate Committee closed" : ""}
        </p>

        {editing && data.status === "Committee" && (
          <div className="space-y-6 border-t pt-5">
            <div className="flex gap-3 border-l-2 border-primary bg-primary/5 px-4 py-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">Assess the real-world impact</p>
                <p className="mt-0.5 text-muted-foreground">
                  Please ensure your assessment is accurate and reflects the
                  real-world changes this bill would make.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <h3 className="font-serif font-semibold">Statistic changes</h3>
                <p className="text-sm text-muted-foreground">
                  Choose up to five of the bill's most important effects.
                </p>
              </div>
              {stats.map((row) => {
                const definition = data.definitions.stats.find(
                  ({ key }) => key === row.statKey,
                )!;
                return (
                  <div key={row.statKey} className="space-y-2 border p-3">
                    <div className="flex items-center justify-between">
                      <strong className="text-sm">{definition.name}</strong>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${definition.name}`}
                        onClick={() =>
                          setStats((items) =>
                            items.filter(
                              (item) => item.statKey !== row.statKey,
                            ),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-1 sm:grid-cols-5">
                      {effectChoices.map(([value, label]) => (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant={row.effect === value ? "default" : "outline"}
                          aria-pressed={row.effect === value}
                          disabled={
                            usedImpact -
                              Math.abs(row.effect) +
                              Math.abs(value) >
                            ASSESSMENT_IMPACT_BUDGET
                          }
                          onClick={() =>
                            setStats((items) =>
                              items.map((item) =>
                                item.statKey === row.statKey
                                  ? { ...item, effect: value }
                                  : item,
                              ),
                            )
                          }
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {stats.length < 5 && (
                <CataloguePicker
                  id="stat"
                  label="Add statistic"
                  itemLabel="Statistic"
                  searchPlaceholder="Filter statistics by name"
                  definitions={data.definitions.stats}
                  excludedKeys={stats.map((row) => row.statKey)}
                  category={statCategory}
                  onCategoryChange={setStatCategory}
                  query={statQuery}
                  onQueryChange={setStatQuery}
                  selectedKey={selectedStat}
                  onSelectedKeyChange={setSelectedStat}
                  onAdd={(key) => {
                    setStats((items) => [
                      ...items,
                      { statKey: key, effect: 0 },
                    ]);
                    setSelectedStat("");
                  }}
                />
              )}
            </div>
            <div className="space-y-3">
              <div>
                <h3 className="font-serif font-semibold">Policy changes</h3>
                <p className="text-sm text-muted-foreground">
                  Optional. Propose only policies directly addressed by the
                  bill.
                </p>
              </div>
              {policies.map((row) => {
                const definition = data.definitions.policies.find(
                  ({ key }) => key === row.policyKey,
                )!;
                return (
                  <div
                    key={row.policyKey}
                    className="grid gap-2 border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                  >
                    <div>
                      <strong className="text-sm">{definition.name}</strong>
                      <p className="text-xs text-muted-foreground">
                        Current:{" "}
                        {formatPolicyValue(
                          data.currentPolicies[row.policyKey] as PolicyValue,
                        )}
                      </p>
                    </div>
                    <PolicyControl
                      definition={definition}
                      value={row.value}
                      onChange={(value) =>
                        setPolicies((items) =>
                          items.map((item) =>
                            item.policyKey === row.policyKey
                              ? { ...item, value }
                              : item,
                          ),
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${definition.name}`}
                      onClick={() =>
                        setPolicies((items) =>
                          items.filter(
                            (item) => item.policyKey !== row.policyKey,
                          ),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              <CataloguePicker
                id="policy"
                label="Add policy change"
                itemLabel="Policy"
                searchPlaceholder="Filter policies by name"
                definitions={data.definitions.policies}
                excludedKeys={policies.map((row) => row.policyKey)}
                category={policyCategory}
                onCategoryChange={setPolicyCategory}
                query={policyQuery}
                onQueryChange={setPolicyQuery}
                selectedKey={selectedPolicy}
                onSelectedKeyChange={setSelectedPolicy}
                onAdd={(key) => {
                  const definition = data.definitions.policies.find(
                    (policy) => policy.key === key,
                  );
                  if (!definition) return;
                  setPolicies((items) => [
                    ...items,
                    {
                      policyKey: definition.key,
                      value:
                        definition.type === "boolean"
                          ? !data.currentPolicies[definition.key]
                          : (definition.options?.find(
                              (option) =>
                                option !== data.currentPolicies[definition.key],
                            ) ??
                            definition.min ??
                            0),
                    },
                  ]);
                  setSelectedPolicy("");
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button disabled={pending} onClick={save}>
                {pending ? "Saving…" : "Save assessment"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </WikiSection>
  );
}

type CatalogueDefinition = { key: string; name: string; category: string };

function CataloguePicker({
  id,
  label,
  itemLabel,
  searchPlaceholder,
  definitions,
  excludedKeys,
  category,
  onCategoryChange,
  query,
  onQueryChange,
  selectedKey,
  onSelectedKeyChange,
  onAdd,
}: {
  id: string;
  label: string;
  itemLabel: string;
  searchPlaceholder: string;
  definitions: Array<CatalogueDefinition>;
  excludedKeys: Array<string>;
  category: string;
  onCategoryChange: (category: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  selectedKey: string;
  onSelectedKeyChange: (key: string) => void;
  onAdd: (key: string) => void;
}) {
  const excluded = new Set(excludedKeys);
  const categories = [
    ...new Set(definitions.map((item) => item.category)),
  ].sort((left, right) =>
    categoryLabel(left).localeCompare(categoryLabel(right)),
  );
  const normalizedQuery = query.trim().toLowerCase();
  const available = definitions.filter(
    (item) =>
      !excluded.has(item.key) &&
      (category === "all" || item.category === category) &&
      (!normalizedQuery || item.name.toLowerCase().includes(normalizedQuery)),
  );
  const grouped = categories.flatMap((group) => {
    const items = available.filter((item) => item.category === group);
    return items.length ? [{ category: group, items }] : [];
  });

  return (
    <fieldset className="space-y-3 border bg-muted/20 p-3">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label
          className="space-y-1 text-sm font-medium"
          htmlFor={`${id}-category`}
        >
          Category
          <select
            id={`${id}-category`}
            className="block h-10 w-full rounded-md border bg-background px-3 font-normal"
            value={category}
            onChange={(event) => {
              onCategoryChange(event.target.value);
              onSelectedKeyChange("");
            }}
          >
            <option value="all">All categories</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {categoryLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label
          className="space-y-1 text-sm font-medium"
          htmlFor={`${id}-search`}
        >
          Search within selection
          <Input
            id={`${id}-search`}
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              onSelectedKeyChange("");
            }}
            placeholder={searchPlaceholder}
          />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="space-y-1 text-sm font-medium" htmlFor={`${id}-item`}>
          {itemLabel}
          <select
            id={`${id}-item`}
            className="block h-10 w-full rounded-md border bg-background px-3 font-normal"
            value={selectedKey}
            onChange={(event) => onSelectedKeyChange(event.target.value)}
          >
            <option value="">
              {available.length
                ? `Choose from ${available.length} ${available.length === 1 ? "option" : "options"}`
                : "No matching options"}
            </option>
            {grouped.map((group) => (
              <optgroup
                key={group.category}
                label={categoryLabel(group.category)}
              >
                {group.items.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={!selectedKey}
          onClick={() => selectedKey && onAdd(selectedKey)}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {available.length} available in this selection. Already-added items are
        hidden.
      </p>
    </fieldset>
  );
}

function categoryLabel(category: string) {
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function PolicyControl({
  definition,
  value,
  onChange,
}: {
  definition: CommitteeData["definitions"]["policies"][number];
  value: PolicyValue;
  onChange: (value: PolicyValue) => void;
}) {
  if (definition.type === "boolean")
    return (
      <select
        aria-label={`Proposed ${definition.name}`}
        className="h-9 rounded-md border bg-background px-3 text-sm"
        value={String(value)}
        onChange={(event) => onChange(event.target.value === "true")}
      >
        <option value="true">On</option>
        <option value="false">Off</option>
      </select>
    );
  if (definition.type === "number")
    return (
      <Input
        aria-label={`Proposed ${definition.name}`}
        className="w-24"
        type="number"
        min={definition.min ?? undefined}
        max={definition.max ?? undefined}
        value={Number(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    );
  return (
    <select
      aria-label={`Proposed ${definition.name}`}
      className="h-9 max-w-56 rounded-md border bg-background px-3 text-sm"
      value={String(value)}
      onChange={(event) => onChange(event.target.value)}
    >
      {definition.options?.map((option) => (
        <option key={option} value={option}>
          {formatPolicyValue(option)}
        </option>
      ))}
    </select>
  );
}
