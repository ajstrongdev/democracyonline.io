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
  Handshake,
  Pencil,
  Users,
  X,
} from "lucide-react";
import {
  acceptJoinRequest,
  declineJoinRequest,
  getCoalitionDetails,
  leaveCoalition,
  requestJoinCoalition,
  updateCoalition,
} from "@/lib/server/coalitions";
import { getCurrentUserInfo } from "@/lib/server/users";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export const Route = createFileRoute("/dashboard/parties/coalitions/$id")({
  loader: async ({ params }) => {
    const coalitionId = Number(params.id);
    if (isNaN(coalitionId)) {
      throw redirect({ to: "/dashboard/parties" });
    }

    const userInfo = await getCurrentUserInfo();

    const details = await getCoalitionDetails({
      data: {
        coalitionId,
        userId: userInfo?.id ?? null,
      },
    });

    return { ...details, userInfo };
  },
  gcTime: 0,
  component: CoalitionPage,
});

function CoalitionPage() {
  const {
    coalition,
    memberParties,
    pendingRequests,
    callerPartyId: loaderCallerPartyId,
    callerCoalitionId: loaderCallerCoalitionId,
    userInfo: loaderUserInfo,
  } = Route.useLoaderData();
  const userInfo = useUserData(loaderUserInfo);
  const navigate = useNavigate();

  // Re-derive membership status client-side for robustness
  const callerPartyId = userInfo?.partyId ?? loaderCallerPartyId;
  const memberPartyIds = memberParties.map((p) => p.id);
  const isInThisCoalition =
    callerPartyId != null && memberPartyIds.includes(callerPartyId);
  const callerParty = memberParties.find((p) => p.id === callerPartyId);
  const isMemberPartyLeader =
    isInThisCoalition && callerParty?.leaderId === userInfo?.id;
  const canJoin =
    callerPartyId != null &&
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
      alert(e.message);
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
      alert(e.message);
    }
  };

  const handleLeave = async () => {
    try {
      await leaveCoalition({ data: { coalitionId: coalition.id } });
      navigate({ to: "/dashboard/parties" });
    } catch (e: any) {
      alert(e.message);
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
      alert(e.message);
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
      alert(e.message);
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
          eyebrow="Political coalition"
          title={coalition.name}
          description={coalition.bio || "No description has been recorded."}
          status={
            <CoalitionLogo
              coalition_id={coalition.id}
              size={64}
              color={coalition.color}
              logo={coalition.logo}
              name={coalition.name}
            />
          }
        />
        <nav className="flex flex-wrap gap-2 border-y bg-card px-4 py-3">
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/parties/coalitions">Coalition archive</Link>
          </Button>
          {isMemberPartyLeader && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(!editing)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {editing ? "Cancel edit" : "Edit coalition"}
            </Button>
          )}
          {isMemberPartyLeader && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowLeaveDialog(true)}
            >
              <DoorOpen className="mr-2 h-4 w-4" />
              Leave coalition
            </Button>
          )}
          {canJoin && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowJoinDialog(true)}
            >
              <Handshake className="mr-2 h-4 w-4" />
              Request to join
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
                <Label htmlFor="edit-bio">Description</Label>
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
          <WikiStat label="Member parties" value={memberParties.length} />
          <WikiStat
            label="Total members"
            value={totalCoalitionMembers}
            detail="Across all member parties"
          />
          <WikiStat label="Pending requests" value={pendingRequests.length} />
        </WikiStatGrid>

        {/* Tabs: Parties | Join Requests */}
        <Tabs defaultValue="parties" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="parties">Member Parties</TabsTrigger>
            <TabsTrigger value="requests">
              Join Requests
              {pendingRequests.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parties">
            <WikiSection
              title="Member parties"
              description="Parties that form this coalition."
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
        </Tabs>

        {/* Dialogs */}
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
