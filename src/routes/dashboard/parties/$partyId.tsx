import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowRightLeft,
  Building2,
  ExternalLink,
  Users,
  Vote,
} from "lucide-react";
import { WikiArticleSection } from "@/components/wiki/wiki-article-section";
import { ResultBar, WikiHeader } from "@/components/wiki/wiki-header";
import {
  WikiInfobox,
  WikiInfoboxRow,
  WikiPage,
} from "@/components/wiki/wiki-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWikiParty } from "@/lib/server/history";
import { getWikiArticle } from "@/lib/server/wiki-articles";
import { getCurrentUserInfo } from "@/lib/server/users";
import {
  becomePartyLeader,
  getPartyStances,
  joinParty,
  leaveParty,
} from "@/lib/server/party";
import {
  formatElectionTitle,
  formatWikiDate,
  getVoteShare,
} from "@/lib/utils/history";

export const Route = createFileRoute("/dashboard/parties/$partyId")({
  loader: async ({ params }) => {
    const id = Number(params.partyId);
    if (!Number.isInteger(id))
      throw new Response("Party not found", { status: 404 });
    const [party, article, currentUser, stances] = await Promise.all([
      getWikiParty({ data: { id } }),
      getWikiArticle({
        data: { entityType: "party", entityId: params.partyId },
      }),
      getCurrentUserInfo(),
      getPartyStances({ data: { partyId: id } }),
    ]);
    if (!party) throw new Response("Party not found", { status: 404 });
    return { ...party, article, currentUser, stances };
  },
  component: PartyArticle,
});

function PartyArticle() {
  const {
    party,
    members,
    results,
    representation,
    defections,
    article,
    currentUser,
    stances,
  } = Route.useLoaderData();
  return (
    <WikiPage width="article">
      <WikiHeader
        eyebrow={
          party.current ? "Current political party" : "Archived political party"
        }
        title={party.name}
        description={
          party.bio ||
          `${party.name} is documented in the Democracy Online political record.`
        }
        status={
          <Badge variant={party.current ? "default" : "secondary"}>
            {party.current ? "Current" : "Archived"}
          </Badge>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <WikiArticleSection
          entityType="party"
          entityId={String(party.id)}
          article={article}
        />
        <WikiInfobox title={party.name} accent={party.color}>
          <WikiInfoboxRow label="Status">
            {party.current ? "Current" : "Archived"}
          </WikiInfoboxRow>
          <WikiInfoboxRow label="Position">
            {party.leaning ?? "Not recorded"}
          </WikiInfoboxRow>
          <WikiInfoboxRow label="Members">{members.length}</WikiInfoboxRow>
          {party.current && party.discord && (
            <WikiInfoboxRow label="Community">
              <a
                href={party.discord}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Discord
              </a>
            </WikiInfoboxRow>
          )}
          {!party.current && party.archivedAt && (
            <WikiInfoboxRow label="Archived">
              {formatWikiDate(party.archivedAt)}
            </WikiInfoboxRow>
          )}
          {party.current && currentUser && (
            <WikiInfoboxRow label="Organization">
              <PartyActions party={party} currentUser={currentUser} />
            </WikiInfoboxRow>
          )}
        </WikiInfobox>
      </div>
      {party.current && stances.length > 0 && (
        <Card className="rounded-sm shadow-none">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Platform</CardTitle>
          </CardHeader>
          <CardContent className="divide-y border-y">
            {stances.map((stance) => (
              <div key={stance.stanceId} className="py-3">
                <h3 className="font-semibold">{stance.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {stance.value}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-sm shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-2xl">
              <Vote className="h-5 w-5" /> Electoral record
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.map((result) => {
              const share = getVoteShare(result.points, result.totalPoints);
              return (
                <Link
                  key={result.historyId}
                  to="/dashboard/elections/$electionId"
                  params={{ electionId: String(result.historyId) }}
                  className="block rounded-lg border p-4 hover:border-primary"
                >
                  <div className="flex justify-between gap-3">
                    <strong>
                      {formatElectionTitle(result.election, result.cycle)}
                    </strong>
                    <Badge variant="outline">{result.elected} elected</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {result.candidates} candidates · {result.firstPreferences}{" "}
                    first preferences · {result.points} points
                  </p>
                  <div className="mt-3">
                    <ResultBar value={share} />
                  </div>
                </Link>
              );
            })}
            {!results.length && (
              <p className="py-8 text-center text-muted-foreground">
                No certified election appearances.
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-sm shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-2xl">
              <Building2 className="h-5 w-5" /> Representation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {representation.map((snapshot) => (
              <Link
                key={snapshot.historyId}
                to="/dashboard/elections/$electionId"
                params={{ electionId: String(snapshot.historyId) }}
                className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border p-3 hover:border-primary"
              >
                <span className="font-medium">
                  {formatElectionTitle(snapshot.election, snapshot.cycle)}
                </span>
                <span className="font-mono text-xs">
                  House {snapshot.house} · Senate {snapshot.senate} · President{" "}
                  {snapshot.president}
                </span>
              </Link>
            ))}
            {!representation.length && (
              <p className="py-8 text-center text-muted-foreground">
                No government representation recorded.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
      <Card className="rounded-sm shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-2xl">
            <ArrowRightLeft className="h-5 w-5" /> Defections
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Recorded movements between this party, other parties, and
            Independent status.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {defections.map((defection) => (
            <div
              key={defection.id}
              className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                {defection.userId ? (
                  <Link
                    to="/dashboard/players/$playerId"
                    params={{ playerId: String(defection.userId) }}
                    className="font-semibold hover:text-primary"
                  >
                    {defection.username}
                  </Link>
                ) : (
                  <strong>{defection.username}</strong>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <PartyIdentity
                    name={defection.fromPartyName ?? "Independent"}
                    color={defection.fromPartyColor ?? "#64748b"}
                  />
                  <ArrowRight className="h-3.5 w-3.5" />
                  <PartyIdentity
                    name={defection.toPartyName ?? "Independent"}
                    color={defection.toPartyColor ?? "#64748b"}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                <Badge variant="outline">
                  {defection.fromPartyId === party.id ? "Departed" : "Joined"}
                </Badge>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {formatWikiDate(defection.occurredAt)} · {defection.office}
                </p>
              </div>
            </div>
          ))}
          {!defections.length && (
            <p className="py-8 text-center text-muted-foreground">
              No defections recorded.
            </p>
          )}
        </CardContent>
      </Card>
      {party.current && (
        <Card className="rounded-sm shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-2xl">
              <Users className="h-5 w-5" /> Current members
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {members.map((member) => (
              <Link
                key={member.id}
                to="/dashboard/players/$playerId"
                params={{ playerId: String(member.id) }}
                className="flex justify-between rounded-md border p-3 hover:border-primary"
              >
                <strong>{member.username}</strong>
                <Badge variant="outline">{member.role}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </WikiPage>
  );
}

function PartyActions({
  party,
  currentUser,
}: {
  party: {
    id: number;
    leaderId: number | null;
  };
  currentUser: {
    id: number;
    partyId: number | null;
  };
}) {
  const router = useRouter();
  const isMember = currentUser.partyId === party.id;
  const isLeader = party.leaderId === currentUser.id;
  const refresh = () => router.invalidate();

  return (
    <div className="flex flex-col items-end gap-1">
      {isLeader && (
        <>
          <Button variant="link" className="h-auto p-0" asChild>
            <Link
              to="/dashboard/parties/manage/$id"
              params={{ id: String(party.id) }}
            >
              Manage <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button variant="link" className="h-auto p-0" asChild>
            <Link
              to="/dashboard/parties/merge/$id"
              params={{ id: String(party.id) }}
            >
              Merge requests
            </Link>
          </Button>
        </>
      )}
      {isMember && !party.leaderId && (
        <Button
          variant="link"
          className="h-auto p-0"
          onClick={async () => {
            await becomePartyLeader({
              data: { userId: currentUser.id, partyId: party.id },
            });
            await refresh();
          }}
        >
          Claim leadership
        </Button>
      )}
      {isMember ? (
        <Button
          variant="link"
          className="h-auto p-0 text-red-700 dark:text-red-400"
          onClick={async () => {
            await leaveParty({ data: { userId: currentUser.id } });
            await refresh();
          }}
        >
          Leave party
        </Button>
      ) : currentUser.partyId ? (
        <span className="text-xs text-muted-foreground">
          Leave your current party first
        </span>
      ) : (
        <Button
          variant="link"
          className="h-auto p-0"
          onClick={async () => {
            await joinParty({
              data: { userId: currentUser.id, partyId: party.id },
            });
            await refresh();
          }}
        >
          Join party
        </Button>
      )}
    </div>
  );
}

function PartyIdentity({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{name}</span>
    </span>
  );
}
