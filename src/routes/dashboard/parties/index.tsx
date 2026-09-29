import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { toast } from "sonner";
import type { ChartConfig } from "@/components/ui/chart";
import { WikiHeader } from "@/components/wiki/wiki-header";
import {
  WikiPage,
  WikiSearch,
  WikiSection,
} from "@/components/wiki/wiki-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getWikiParties } from "@/lib/server/history/history";
import { getCurrentUserInfo } from "@/lib/server/users/users";
import { NewPartyDialog } from "@/components/wiki/new-party-dialog";
import {
  getMyPressureGroup,
  listPressureGroups,
} from "@/lib/server/organizations/pressure-groups";
import {
  cancelPartyFormation,
  getMyPartyFormationProgress,
  getPartyFormationInvites,
  respondToPartyFormation,
} from "@/lib/server/organizations/party";

export const Route = createFileRoute("/dashboard/parties/")({
  validateSearch: (search: Record<string, unknown>) =>
    search.create === true || search.create === "true"
      ? { create: true as const }
      : {},
  loader: async () => {
    const [
      parties,
      currentUser,
      invites,
      formationProgress,
      pressureGroups,
      myGroupId,
    ] = await Promise.all([
      getWikiParties(),
      getCurrentUserInfo(),
      getPartyFormationInvites(),
      getMyPartyFormationProgress(),
      listPressureGroups(),
      getMyPressureGroup(),
    ]);
    return {
      parties,
      currentUser,
      invites,
      formationProgress,
      pressureGroups,
      myGroupId,
    };
  },
  component: PartyIndex,
});

function PartyIndex() {
  const {
    parties,
    currentUser,
    invites,
    formationProgress,
    pressureGroups,
    myGroupId,
  } = Route.useLoaderData();
  const activeFormationInvite = formationProgress.find(
    (invite) => invite.status === "pending" || invite.status === "accepted",
  );
  const router = useRouter();
  const { create } = Route.useSearch();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const filtered = parties.filter((party) =>
    `${party.name} ${party.leaning ?? ""}`
      .toLowerCase()
      .includes(deferredQuery),
  );
  const current = filtered.filter((party) => party.current);
  const archived = filtered.filter((party) => !party.current);
  return (
    <WikiPage>
      <WikiHeader
        eyebrow={`${parties.length} articles`}
        title="Political parties"
        description="Current and historical parties, their electoral records, representation, membership, and community-written histories."
      />
      <nav className="flex flex-wrap gap-2 border-y bg-card px-4 py-3">
        <NewPartyDialog
          user={currentUser}
          groupId={myGroupId}
          autoOpen={create}
        />
        {myGroupId && (
          <Button asChild size="sm" variant="outline">
            <Link
              to="/dashboard/parties/pressure-groups/$groupId"
              params={{ groupId: String(myGroupId) }}
            >
              Your pressure group
            </Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to="/dashboard/parties/primaries">Presidential primaries</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/dashboard/parties/coalitions">Coalitions</Link>
        </Button>
      </nav>
      <WikiSection
        title="Forming parties"
        description="Pressure groups are public, but members remain Independent until three players join."
      >
        <div className="flex flex-wrap gap-2">
          {pressureGroups.map((group) => (
            <Link
              key={group.id}
              to="/dashboard/parties/pressure-groups/$groupId"
              params={{ groupId: String(group.id) }}
              className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-2 text-sm transition-colors hover:border-primary hover:text-primary"
            >
              <span className="font-medium">{group.name}</span>
              <Badge variant="secondary">{group.count}/3</Badge>
            </Link>
          ))}
          {!pressureGroups.length && (
            <p className="text-sm text-muted-foreground">
              No groups forming yet. Start one to bring players together.
            </p>
          )}
        </div>
      </WikiSection>
      {formationProgress.length > 0 && (
        <WikiSection
          title="Your party formation"
          description="Your new party will appear when both cofounders agree."
        >
          <ul className="space-y-2 text-sm">
            {formationProgress.map((invite) => (
              <li key={invite.id}>
                {invite.name} · {invite.invitee} ({invite.office}):{" "}
                <strong>{invite.status}</strong>
              </li>
            ))}
          </ul>
          {activeFormationInvite && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={async () => {
                if (
                  !window.confirm(
                    "Cancel this party formation and withdraw both invitations?",
                  )
                )
                  return;
                try {
                  await cancelPartyFormation({
                    data: { inviteId: activeFormationInvite.id },
                  });
                  await router.invalidate();
                  toast.success("Invitations withdrawn");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not cancel formation",
                  );
                }
              }}
            >
              Withdraw invitations
            </Button>
          )}
        </WikiSection>
      )}
      {invites.length > 0 && (
        <WikiSection
          title="Party formation invitations"
          description="A party forms only when both invited cofounders accept. You must remain independent."
        >
          <div className="space-y-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <span>
                  <strong>{invite.founder}</strong> invites you to found{" "}
                  <strong>{invite.name}</strong> as {invite.office}.{" "}
                  <strong>
                    {invite.status !== "pending" ? `(${invite.status})` : ""}
                  </strong>
                </span>
                {invite.status === "pending" && (
                  <div className="flex gap-2">
                    {([true, false] as const).map((accept) => (
                      <Button
                        key={String(accept)}
                        size="sm"
                        variant={accept ? "default" : "outline"}
                        onClick={async () => {
                          try {
                            const result = await respondToPartyFormation({
                              data: { inviteId: invite.id, accept },
                            });
                            await router.invalidate();
                            toast.success(
                              result.formed
                                ? "Party formed"
                                : accept
                                  ? "Invitation accepted; awaiting the other cofounder"
                                  : "Invitation declined",
                            );
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Could not respond",
                            );
                          }
                        }}
                      >
                        {accept ? "Accept" : "Decline"}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </WikiSection>
      )}
      <WikiSearch
        value={query}
        onChange={setQuery}
        placeholder="Search the party archive"
        resultCount={filtered.length}
      />
      <PartyComparison parties={parties.filter((party) => party.current)} />
      <PartySection title="Active parties" parties={current} />
      <PartySection title="Archived parties" parties={archived} />
    </WikiPage>
  );
}

const comparisonConfig = {
  memberCount: { label: "Members", color: "var(--chart-1)" },
} satisfies ChartConfig;

function PartyComparison({ parties }: { parties: Array<PartySummary> }) {
  if (!parties.length) return null;
  const height = Math.max(300, parties.length * 48);

  return (
    <WikiSection
      title="Party comparison"
      description="Current membership across active parties."
      icon={BarChart3}
    >
      <div className="overflow-x-auto">
        <ChartContainer
          config={comparisonConfig}
          className="min-w-[42rem] w-full"
          style={{ height }}
        >
          <BarChart
            accessibilityLayer
            data={parties}
            layout="vertical"
            margin={{ left: 8, right: 16 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={132}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="memberCount" radius={[0, 3, 3, 0]}>
              {parties.map((party) => (
                <Cell key={party.id} fill={party.color} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </WikiSection>
  );
}

type PartySummary = ReturnType<typeof Route.useLoaderData>["parties"][number];

function PartySection({
  title,
  parties,
}: {
  title: string;
  parties: Array<PartySummary>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between border-b pb-2">
        <h2 className="font-serif text-2xl font-semibold">{title}</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {parties.length}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {parties.map((party) => (
          <Link
            key={party.id}
            to="/dashboard/parties/$partyId"
            params={{ partyId: String(party.id) }}
          >
            <Card className="h-full overflow-hidden rounded-sm shadow-none transition-colors hover:border-primary">
              <div className="h-1.5" style={{ backgroundColor: party.color }} />
              <CardContent className="space-y-4 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-serif text-xl font-bold">{party.name}</h2>
                  <Badge variant={party.current ? "default" : "secondary"}>
                    {party.current ? "Current" : "Archived"}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {party.bio || party.leaning || "No summary has been written."}
                </p>
                <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center font-mono text-xs">
                  <span>
                    <strong className="block text-lg text-foreground">
                      {party.memberCount}
                    </strong>
                    members
                  </span>
                  <span>
                    <strong className="block text-lg text-foreground">
                      {party.appearances}
                    </strong>
                    candidacies
                  </span>
                  <span>
                    <strong className="block text-lg text-foreground">
                      {party.victories}
                    </strong>
                    elected
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!parties.length && (
          <p className="col-span-full py-6 text-sm text-muted-foreground">
            No matching parties.
          </p>
        )}
      </div>
    </section>
  );
}
