import { useState } from "react";
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import {
  Check,
  Crown,
  DoorOpen,
  FileText,
  Handshake,
  Pencil,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  acceptJoinRequest,
  declineJoinRequest,
  getCoalitionDetails,
  leaveCoalition,
  requestJoinCoalition,
  reviveCoalition,
  updateCoalition,
} from "@/lib/server/coalitions";
import {
  castVote,
  getCoalitionProposals,
  resolveProposal,
} from "@/lib/server/coalition-proposals";
import { getCurrentUserInfo } from "@/lib/server/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageDialog } from "@/components/message-dialog";
import ProtectedRoute from "@/components/auth/protected-route";
import PartyLogo from "@/components/party-logo";
import CoalitionLogo from "@/components/coalition-logo";
import { useUserData } from "@/lib/hooks/use-user-data";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { icons } from "@/lib/utils/logo-helper";
import { WikiHeader } from "@/components/wiki/wiki-header";
import {
  WikiEmpty,
  WikiPage,
  WikiSection,
  WikiStat,
  WikiStatGrid,
} from "@/components/wiki/wiki-layout";
import { EntityReferenceText } from "@/components/entity-reference-text";
import { ReferenceInsert } from "@/components/reference-insert";
import { formatWikiDate } from "@/lib/utils/history";

export const Route = createFileRoute("/dashboard/parties/coalitions/$id")({
  loader: async ({ params }) => {
    const coalitionId = Number(params.id);
    if (isNaN(coalitionId)) {
      throw redirect({ to: "/dashboard/parties" });
    }

    const [userInfo, details, proposals] = await Promise.all([
      getCurrentUserInfo(),
      getCoalitionDetails({ data: { coalitionId } }),
      getCoalitionProposals({ data: { coalitionId } }),
    ]);

    return { ...details, userInfo, proposals };
  },
  gcTime: 0,
  component: CoalitionPage,
});

function CoalitionPage() {
  const {
    coalition,
    memberParties,
    pendingRequests,
    isCallerPartyLeader,
    callerPartyId: loaderCallerPartyId,
    callerCoalitionId: loaderCallerCoalitionId,
    userInfo: loaderUserInfo,
    canRevive,
    proposals,
  } = Route.useLoaderData();
  const userInfo = useUserData(loaderUserInfo);
  const navigate = useNavigate();

  // Re-derive membership status client-side for robustness
  const callerPartyId = userInfo?.partyId ?? loaderCallerPartyId;
  const memberPartyIds = memberParties.map((p) => p.id);
  const isInThisCoalition =
    callerPartyId != null && memberPartyIds.includes(callerPartyId);
  const isMemberPartyLeader = isInThisCoalition && isCallerPartyLeader;
  const canJoin =
    callerPartyId != null &&
    isCallerPartyLeader &&
    !isInThisCoalition &&
    loaderCallerCoalitionId == null;

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(coalition?.name ?? "");
  const [editColor, setEditColor] = useState(coalition?.color ?? "#3b82f6");
  const [editBio, setEditBio] = useState(coalition?.bio ?? "");
  const [editLogo, setEditLogo] = useState<string | null>(
    coalition?.logo ?? null,
  );

  // Dialogs
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showReviveDialog, setShowReviveDialog] = useState(false);

  if (!coalition) {
    return (
      <ProtectedRoute>
        <WikiPage>
          <WikiEmpty>
            Coalition not found.{" "}
            <Link
              to="/dashboard/parties/coalitions"
              className="text-primary underline"
            >
              Return to the coalition archive.
            </Link>
          </WikiEmpty>
        </WikiPage>
      </ProtectedRoute>
    );
  }

  const handleSaveEdit = async () => {
    try {
      await updateCoalition({
        data: {
          coalitionId: coalition.id,
          name: editName,
          color: editColor,
          bio: editBio,
          logo: editLogo,
        },
      });
      setEditing(false);
      navigate({
        to: "/dashboard/parties/coalitions/$id",
        params: { id: coalition.id.toString() },
      });
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Could not update coalition");
    }
  };

  const handleJoin = async () => {
    try {
      await requestJoinCoalition({ data: { coalitionId: coalition.id } });
      navigate({
        to: "/dashboard/parties/coalitions/$id",
        params: { id: coalition.id.toString() },
      });
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Could not join coalition");
    }
  };

  const handleLeave = async () => {
    try {
      await leaveCoalition({ data: { coalitionId: coalition.id } });
      navigate({ to: "/dashboard/parties" });
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Could not leave coalition");
    }
  };

  const handleRevive = async () => {
    try {
      await reviveCoalition({ data: { coalitionId: coalition.id } });
      toast.success(
        `${coalition.name} revived with your party as its sole member`,
      );
      navigate({
        to: "/dashboard/parties/coalitions/$id",
        params: { id: coalition.id.toString() },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not revive coalition",
      );
    }
  };

  const handleAccept = async (requestId: number) => {
    try {
      await acceptJoinRequest({ data: { requestId } });
      navigate({
        to: "/dashboard/parties/coalitions/$id",
        params: { id: coalition.id.toString() },
      });
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Could not accept request");
    }
  };

  const handleDecline = async (requestId: number) => {
    try {
      await declineJoinRequest({ data: { requestId } });
      navigate({
        to: "/dashboard/parties/coalitions/$id",
        params: { id: coalition.id.toString() },
      });
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Could not decline request");
    }
  };

  const handleVote = async (proposalId: number, vote: boolean) => {
    try {
      await castVote({ data: { proposalId, vote } });
      navigate({
        to: "/dashboard/parties/coalitions/$id",
        params: { id: coalition.id.toString() },
      });
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Could not cast vote");
    }
  };

  const handleResolve = async (proposalId: number) => {
    try {
      const result = await resolveProposal({ data: { proposalId } });
      toast.success(
        result.approved ? "Proposal approved" : "Proposal rejected",
      );
      navigate({
        to: "/dashboard/parties/coalitions/$id",
        params: { id: coalition.id.toString() },
      });
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Could not resolve proposal");
    }
  };

  const totalCoalitionMembers = memberParties.reduce(
    (sum, p) => sum + Number(p.memberCount || 0),
    0,
  );

  return (
    <ProtectedRoute>
      <WikiPage>
        <WikiHeader
          eyebrow={
            coalition.archivedAt
              ? "Archived political coalition"
              : "Political coalition"
          }
          title={coalition.name}
          description={
            <EntityReferenceText
              content={coalition.bio || "No description has been recorded."}
            />
          }
          status={
            <div className="flex items-center gap-3">
              <Badge variant={coalition.archivedAt ? "secondary" : "default"}>
                {coalition.archivedAt ? "Archived" : "Active"}
              </Badge>
              <CoalitionLogo
                coalition_id={coalition.id}
                size={64}
                color={coalition.color}
                logo={coalition.logo}
                name={coalition.name}
              />
            </div>
          }
        />
        <nav className="flex flex-wrap gap-2 border-y bg-card px-4 py-3">
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/parties/coalitions">Coalition archive</Link>
          </Button>
          {!coalition.archivedAt && isMemberPartyLeader && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(!editing)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {editing ? "Cancel edit" : "Edit coalition"}
            </Button>
          )}
          {!coalition.archivedAt && isMemberPartyLeader && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowLeaveDialog(true)}
            >
              <DoorOpen className="mr-2 h-4 w-4" />
              Leave coalition
            </Button>
          )}
          {!coalition.archivedAt && canJoin && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowJoinDialog(true)}
            >
              <Handshake className="mr-2 h-4 w-4" />
              Request to join
            </Button>
          )}
          {coalition.archivedAt && canRevive && (
            <Button size="sm" onClick={() => setShowReviveDialog(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Revive with your party
            </Button>
          )}
        </nav>

        {/* Edit Form */}
        {editing && (
          <Card className="rounded-sm shadow-none">
            <CardHeader>
              <CardTitle className="font-serif text-2xl">
                Edit coalition
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-color">Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="edit-color"
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-16 h-10 p-1"
                  />
                  <span className="text-sm text-muted-foreground">
                    {editColor}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="edit-bio">Description</Label>
                  <ReferenceInsert
                    textareaId="edit-bio"
                    value={editBio}
                    onChange={setEditBio}
                  />
                </div>
                <Textarea
                  id="edit-bio"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-4">
                <Label className="text-sm font-medium">Logo</Label>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditLogo(null)}
                    className={`flex items-center justify-center w-14 h-14 rounded-md border p-2 text-sm hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      editLogo === null
                        ? "ring-2 ring-offset-2 ring-primary"
                        : ""
                    }`}
                  >
                    None
                  </button>
                  {icons.map((ic) => {
                    const IconComp = ic.Icon;
                    return (
                      <button
                        key={ic.name}
                        type="button"
                        onClick={() => setEditLogo(ic.name)}
                        className={`flex items-center justify-center w-14 h-14 rounded-md border p-2 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                          editLogo === ic.name
                            ? "ring-2 ring-offset-2 ring-primary"
                            : ""
                        }`}
                        title={ic.name}
                      >
                        <IconComp className="w-6 h-6" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </CardContent>
          </Card>
        )}

        <WikiStatGrid>
          <WikiStat
            label={
              coalition.archivedAt ? "Former member parties" : "Member parties"
            }
            value={memberParties.length}
          />
          <WikiStat
            label="Total members"
            value={totalCoalitionMembers}
            detail="Across all member parties"
          />
          <WikiStat label="Pending requests" value={pendingRequests.length} />
          {coalition.archivedAt && (
            <WikiStat
              label="Archived"
              value={formatWikiDate(coalition.archivedAt)}
            />
          )}
        </WikiStatGrid>

        {/* Tabs: Parties | Join Requests | Proposals */}
        <Tabs defaultValue="parties" className="w-full">
          <TabsList
            className={`grid w-full ${coalition.archivedAt ? "grid-cols-1" : "grid-cols-3"} mb-4`}
          >
            <TabsTrigger value="parties">
              {coalition.archivedAt
                ? "Former Member Parties"
                : "Member Parties"}
            </TabsTrigger>
            {!coalition.archivedAt && (
              <TabsTrigger value="requests">
                Join Requests
                {pendingRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {pendingRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {!coalition.archivedAt && (
              <TabsTrigger value="proposals">
                <FileText className="mr-1 h-3 w-3" />
                Proposals
                {proposals.filter((p) => p.status === "open").length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {proposals.filter((p) => p.status === "open").length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="parties">
            <WikiSection
              title={
                coalition.archivedAt
                  ? "Former member parties"
                  : "Member parties"
              }
              description={
                coalition.archivedAt
                  ? "Parties retained in this coalition's membership record. Revival restores only the sponsoring party."
                  : "Parties that form this coalition."
              }
              icon={Handshake}
            >
              <div>
                <div className="space-y-3 md:space-y-4">
                  {memberParties.map((party) => (
                    <div
                      key={party.id}
                      className="flex flex-col gap-3 border-b bg-card p-3 transition-colors last:border-b-0 sm:flex-row sm:items-center md:gap-4 md:p-4"
                      style={{
                        borderLeftWidth: "4px",
                        borderLeftColor: party.color,
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="shrink-0">
                          <PartyLogo party_id={party.id} size={40} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base truncate">
                            {party.name}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {party.bio || "No description"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 sm:gap-6">
                        <div className="flex flex-col items-start sm:items-end gap-1">
                          <div className="flex items-center gap-2">
                            <Users className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                            <span className="text-xl md:text-2xl font-bold">
                              {party.memberCount}
                            </span>
                          </div>
                          <span className="text-[10px] md:text-xs text-muted-foreground">
                            members
                          </span>
                        </div>
                        <Button
                          asChild
                          variant="default"
                          size="sm"
                          className="whitespace-nowrap"
                        >
                          <Link
                            to="/dashboard/parties/$partyId"
                            params={{ partyId: party.id.toString() }}
                          >
                            View Party
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                  {memberParties.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        No member parties yet.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </WikiSection>
          </TabsContent>

          <TabsContent value="requests">
            <WikiSection
              title="Pending join requests"
              icon={Crown}
              description={`Parties requesting to join this coalition.${!isMemberPartyLeader ? " Only coalition member party leaders can accept or decline." : ""}`}
            >
              <div>
                <p className="sr-only">
                  Parties requesting to join this coalition.
                  {!isMemberPartyLeader &&
                    " Only coalition member party leaders can accept or decline."}
                </p>
                <div className="space-y-3 md:space-y-4">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-col items-start gap-3 border-b bg-card p-3 last:border-b-0 sm:flex-row sm:items-center md:gap-4 md:p-4"
                      style={{
                        borderLeftWidth: "4px",
                        borderLeftColor: req.partyColor,
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="shrink-0">
                          <PartyLogo party_id={req.partyId} size={40} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-base truncate">
                            {req.partyName}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Requested{" "}
                            {req.createdAt
                              ? new Date(req.createdAt).toLocaleDateString()
                              : "recently"}
                          </p>
                        </div>
                      </div>
                      {isMemberPartyLeader && (
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleAccept(req.id)}
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Accept
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDecline(req.id)}
                          >
                            <X className="mr-1 h-4 w-4" />
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {pendingRequests.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        No pending join requests.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </WikiSection>
          </TabsContent>

          <TabsContent value="proposals">
            <WikiSection
              title="Coalition proposals"
              icon={FileText}
              description="Decisions requiring majority approval by member-party leaders."
            >
              <div>
                <div className="space-y-3 md:space-y-4">
                  {proposals.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        No proposals have been submitted.
                      </p>
                    </div>
                  )}
                  {proposals.map((proposal) => {
                    const canVote =
                      isMemberPartyLeader && proposal.status === "open";
                    return (
                      <div
                        key={proposal.id}
                        className="border-b bg-card p-3 last:border-b-0 sm:p-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  proposal.status === "approved"
                                    ? "default"
                                    : proposal.status === "rejected"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {proposal.status}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                Proposal #{proposal.id}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                by {proposal.proposerPartyName}
                              </span>
                            </div>
                            <p className="mt-1 text-sm">
                              {proposal.proposalType === "join_request" &&
                                `Join request for party #${proposal.targetId}`}
                              {proposal.proposalType === "edit" &&
                                "Edit coalition details"}
                              {proposal.proposalType === "leave" &&
                                `Leave coalition (party #${proposal.targetId})`}
                            </p>
                            <div className="mt-2 flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1 text-emerald-600">
                                <ThumbsUp className="h-3 w-3" />
                                {proposal.votesFor} for
                              </span>
                              <span className="flex items-center gap-1 text-red-600">
                                <ThumbsDown className="h-3 w-3" />
                                {proposal.votesAgainst} against
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {proposal.createdAt
                                  ? new Date(
                                      proposal.createdAt,
                                    ).toLocaleDateString()
                                  : ""}
                              </span>
                            </div>
                          </div>
                          {canVote && (
                            <div className="flex gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() =>
                                  handleVote(proposal.id, true)
                                }
                              >
                                <ThumbsUp className="mr-1 h-4 w-4" />
                                For
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  handleVote(proposal.id, false)
                                }
                              >
                                <ThumbsDown className="mr-1 h-4 w-4" />
                                Against
                              </Button>
                              {isMemberPartyLeader && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleResolve(proposal.id)
                                  }
                                >
                                  Resolve
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </WikiSection>
          </TabsContent>
        </Tabs>
        <MessageDialog
          open={showLeaveDialog}
          onOpenChange={setShowLeaveDialog}
          title="Leave Coalition"
          description="Are you sure you want your party to leave this coalition? If your party is the last member, the coalition will be dissolved."
          confirmText="Leave"
          variant="destructive"
          onConfirm={handleLeave}
        />
        <MessageDialog
          open={showReviveDialog}
          onOpenChange={setShowReviveDialog}
          title={`Revive ${coalition.name}`}
          description="This restores the coalition with your current party as its sole member. Former member parties are not automatically rejoined."
          confirmText="Revive coalition"
          onConfirm={handleRevive}
        />
        <MessageDialog
          open={showJoinDialog}
          onOpenChange={setShowJoinDialog}
          title="Request to Join"
          description="Send a request for your party to join this coalition? A coalition member party leader will need to accept your request."
          confirmText="Send Request"
          onConfirm={handleJoin}
        />
      </WikiPage>
    </ProtectedRoute>
  );
}
