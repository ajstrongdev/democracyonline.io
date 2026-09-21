import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowRightLeft,
  Building2,
  RotateCcw,
  Users,
  Vote,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { WikiArticleSection } from "@/components/wiki/wiki-article-section";
import { ManagePartyDialog } from "@/components/wiki/manage-party-dialog";
import { MessageDialog } from "@/components/message-dialog";
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
  getPartyRevivalState,
  joinParty,
  leaveParty,
  reviveParty,
} from "@/lib/server/party";
import { getPartyCoalition } from "@/lib/server/coalitions";
import { EntityReferenceText } from "@/components/entity-reference-text";
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
    const [party, article, currentUser, coalition, revival] = await Promise.all(
      [
        getWikiParty({ data: { id } }),
        getWikiArticle({
          data: { entityType: "party", entityId: params.partyId },
        }),
        getCurrentUserInfo(),
        getPartyCoalition({ data: { partyId: id } }),
        getPartyRevivalState({ data: { partyId: id } }),
      ],
    );
    if (!party) throw new Response("Party not found", { status: 404 });
    return { ...party, article, currentUser, coalition, revival };
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
    coalition,
    revival,
    leader,
  } = Route.useLoaderData();
  return (
    <WikiPage width="article">
      <WikiHeader
        eyebrow={
          party.current ? "Current political party" : "Archived political party"
        }
        title={party.name}
        description={
          <EntityReferenceText
            content={
              party.bio ||
              `${party.name} is documented in the Democracy Online political record.`
            }
          />
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
          <WikiInfoboxRow label="Leader">
            {leader ? (
              <Link
                to="/dashboard/players/$playerId"
                params={{ playerId: String(leader.id) }}
                className="text-primary hover:underline"
              >
                {leader.username}
              </Link>
            ) : (
              "No leader"
            )}
          </WikiInfoboxRow>
          {party.current && coalition && (
            <WikiInfoboxRow label="Coalition">
              <Link
                to="/dashboard/parties/coalitions/$id"
                params={{ id: String(coalition.id) }}
                className="text-primary hover:underline"
              >
                {coalition.name}
              </Link>
            </WikiInfoboxRow>
          )}
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
          {!party.current && revival.canRevive && (
            <WikiInfoboxRow label="Organization">
              <RevivePartyButton partyId={party.id} partyName={party.name} />
            </WikiInfoboxRow>
          )}
        </WikiInfobox>
      </div>
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

function RevivePartyButton({
  partyId,
  partyName,
}: {
  partyId: number;
  partyName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <>
      <Button
        variant="link"
        className="h-auto p-0"
        disabled={submitting}
        onClick={() => setOpen(true)}
      >
        <RotateCcw className="mr-1 h-3.5 w-3.5" />
        Revive party
      </Button>
      <MessageDialog
        open={open}
        onOpenChange={setOpen}
        title={`Revive ${partyName}`}
        description="This restores the party with you as its sole member and leader. Its identity, platform, and stances remain intact."
        confirmText="Revive party"
        onConfirm={async () => {
          setSubmitting(true);
          try {
            await reviveParty({ data: { partyId } });
            toast.success(`${partyName} revived`);
            await router.invalidate();
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not revive party",
            );
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </>
  );
}

function PartyActions({
  party,
  currentUser,
}: {
  party: {
    id: number;
    leaderId: number | null;
    name: string;
    color: string;
    bio: string | null;
    discord: string | null;
    logo: string | null;
    leaning: string | null;
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
  const [showMembershipDialog, setShowMembershipDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isDefecting = !isMember && currentUser.partyId !== null;

  const changeMembership = async () => {
    setSubmitting(true);
    try {
      if (isMember) {
        await leaveParty({ data: { userId: currentUser.id } });
        toast.success("You are now an independent");
      } else {
        await joinParty({
          data: { userId: currentUser.id, partyId: party.id },
        });
        toast.success(
          isDefecting ? "Party defection recorded" : "Party joined",
        );
      }
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update membership",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {isLeader && <ManagePartyDialog party={party} />}
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
          onClick={() => setShowMembershipDialog(true)}
          disabled={submitting}
        >
          Leave party
        </Button>
      ) : (
        <Button
          variant="link"
          className="h-auto p-0"
          onClick={() => setShowMembershipDialog(true)}
          disabled={submitting}
        >
          {isDefecting ? "Defect" : "Join party"}
        </Button>
      )}
      <MessageDialog
        open={showMembershipDialog}
        onOpenChange={setShowMembershipDialog}
        title={
          isMember
            ? "Leave party"
            : isDefecting
              ? `Defect to ${party.name}`
              : `Join ${party.name}`
        }
        description={
          isMember
            ? "You will become an independent. If you lead this party, its leadership will become vacant."
            : isDefecting
              ? `You will leave your current party and immediately join ${party.name}. This will be recorded as a defection.`
              : `You will join ${party.name}.`
        }
        confirmText={isMember ? "Leave party" : isDefecting ? "Defect" : "Join"}
        variant={isMember || isDefecting ? "destructive" : "default"}
        onConfirm={changeMembership}
      />
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
