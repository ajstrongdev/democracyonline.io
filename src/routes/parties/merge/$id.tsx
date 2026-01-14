import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { ArrowLeftRight, Check, X, XCircle } from "lucide-react";
import { fetchUserInfoByEmail } from "@/lib/server/users";
import {
  checkIfUserIsPartyLeader,
  getParties,
  getPartyById,
  getPoliticalStances,
} from "@/lib/server/party";
import {
  acceptMergeRequest,
  cancelMergeRequest,
  createMergeRequest,
  getMergeRequestsReceived,
  getMergeRequestsSent,
  rejectMergeRequest,
} from "@/lib/server/party-merge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { icons } from "@/lib/utils/logo-helper";
import PartyLogo from "@/components/party-logo";
import ProtectedRoute from "@/components/auth/protected-route";
import { useUserData } from "@/lib/hooks/use-user-data";

export const Route = createFileRoute("/parties/merge/$id")({
  loader: async ({ context, params }) => {
    const partyId = Number(params.id);
    if (isNaN(partyId)) {
      throw redirect({ to: "/parties" });
    }

    const [
      userData,
      party,
      allParties,
      stances,
      receivedRequests,
      sentRequests,
    ] = await Promise.all([
      fetchUserInfoByEmail({
        data: { email: context.auth.user?.email || "" },
      }),
      getPartyById({ data: { partyId } }),
      getParties(),
      getPoliticalStances(),
      getMergeRequestsReceived({ data: { partyId } }),
      getMergeRequestsSent({ data: { partyId } }),
    ]);

    const user = Array.isArray(userData) ? userData[0] : userData;

    if (!party) {
      throw redirect({ to: "/parties" });
    }

    // Hack: Skip isLeader check on SSR and handle in client to prevent navigation issues when navigating directly.
    const isLeader = user?.id
      ? await checkIfUserIsPartyLeader({
          data: { userId: user.id, partyId },
        })
      : false;

    return {
      user,
      party,
      allParties,
      stances,
      receivedRequests,
      sentRequests,
      isLeader,
    };
  },
  component: MergePartyPage,
});

export const leanings = [
  "Far Left",
  "Left",
  "Center Left",
  "Center",
  "Center Right",
  "Right",
  "Far Right",
];

function MergePartyPage() {
  const navigate = useNavigate();
  const {
    party,
    allParties,
    stances,
    receivedRequests,
    sentRequests,
    user: loadingUser,
  } = Route.useLoaderData();
  const user = useUserData(loadingUser);

  // Hack: determine isLeader client-side to handle SSR correctly
  const isLeader = party.leaderId === user?.id;

  if (!isLeader) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto py-8 px-4">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground text-lg">
                Only party leaders can access merge functionality
              </p>
              <Button
                className="mt-4"
                onClick={() =>
                  navigate({
                    to: "/parties/$id",
                    params: { id: String(party.id) },
                  })
                }
              >
                Back to Party
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Merge Party: {party.name}
          </h1>
          <p className="text-muted-foreground">
            Create or manage merge requests with other parties
          </p>
        </div>

        <Tabs defaultValue="view" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="view">View Requests</TabsTrigger>
            <TabsTrigger value="create">Create Request</TabsTrigger>
          </TabsList>

          <TabsContent value="view" className="space-y-6">
            <ViewRequestsTab
              party={party}
              receivedRequests={receivedRequests}
              sentRequests={sentRequests}
              navigate={navigate}
            />
          </TabsContent>

          <TabsContent value="create">
            <CreateRequestTab
              party={party}
              allParties={allParties}
              stances={stances}
              receivedRequests={receivedRequests}
              sentRequests={sentRequests}
            />
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}

function ViewRequestsTab({
  party,
  receivedRequests,
  sentRequests,
  navigate,
}: {
  party: any;
  receivedRequests: Array<any>;
  sentRequests: Array<any>;
  navigate: any;
}) {
  const [processing, setProcessing] = useState<number | null>(null);

  const handleAccept = async (mergeRequestId: number) => {
    setProcessing(mergeRequestId);
    try {
      const result = await acceptMergeRequest({
        data: {
          mergeRequestId,
          partyId: party.id,
        },
      });
      navigate({
        to: "/parties/$id",
        params: { id: String(result.newPartyId) },
      });
    } catch (error) {
      console.error("Error accepting merge request:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to accept merge request",
      );
      setProcessing(null);
    }
  };

  const handleReject = async (mergeRequestId: number) => {
    setProcessing(mergeRequestId);
    try {
      await rejectMergeRequest({
        data: {
          mergeRequestId,
          partyId: party.id,
        },
      });
      window.location.reload();
    } catch (error) {
      console.error("Error rejecting merge request:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to reject merge request",
      );
      setProcessing(null);
    }
  };

  const handleCancel = async (mergeRequestId: number) => {
    setProcessing(mergeRequestId);
    try {
      await cancelMergeRequest({
        data: {
          mergeRequestId,
          partyId: party.id,
        },
      });
      window.location.reload();
    } catch (error) {
      console.error("Error canceling merge request:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to cancel merge request",
      );
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Received Requests */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">
          Received Requests ({receivedRequests.length})
        </h2>
        {receivedRequests.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No pending merge requests received
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {receivedRequests.map((request) => (
              <Card
                key={request.mergeRequestId}
                className="border-l-4"
                style={{ borderLeftColor: request.senderPartyColor }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center">
                        <PartyLogo party_id={request.senderPartyId} size={48} />
                        <span className="text-xs text-muted-foreground mt-1">
                          {request.senderPartyName}
                        </span>
                      </div>
                      <ArrowLeftRight className="text-muted-foreground" />
                      <div className="flex flex-col items-center">
                        <PartyLogo party_id={party.id} size={48} />
                        <span className="text-xs text-muted-foreground mt-1">
                          {party.name}
                        </span>
                      </div>
                      <ArrowLeftRight className="text-muted-foreground" />
                      <div className="flex flex-col items-center">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                          style={{ backgroundColor: request.mergedPartyColor }}
                        >
                          {request.mergedPartyLogo &&
                            icons.find(
                              (i) => i.name === request.mergedPartyLogo,
                            )?.Icon && (
                              <>
                                {(() => {
                                  const IconComp = icons.find(
                                    (i) => i.name === request.mergedPartyLogo,
                                  )?.Icon;
                                  return IconComp ? (
                                    <IconComp className="w-6 h-6 text-white" />
                                  ) : null;
                                })()}
                              </>
                            )}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">
                          New Party
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {request.mergedPartyName}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {request.mergedPartyBio}
                    </p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="text-muted-foreground">Leaning:</span>
                    <span className="font-medium">
                      {request.mergedPartyLeaning}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => handleAccept(request.mergeRequestId)}
                      disabled={processing !== null}
                      className="flex-1"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Accept Merge
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(request.mergeRequestId)}
                      disabled={processing !== null}
                      className="flex-1"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Sent Requests */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">
          Sent Requests ({sentRequests.length})
        </h2>
        {sentRequests.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No pending merge requests sent
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {sentRequests.map((request) => (
              <Card
                key={request.mergeRequestId}
                className="border-l-4"
                style={{ borderLeftColor: request.receiverPartyColor }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center">
                        <PartyLogo party_id={party.id} size={48} />
                        <span className="text-xs text-muted-foreground mt-1">
                          {party.name}
                        </span>
                      </div>
                      <ArrowLeftRight className="text-muted-foreground" />
                      <div className="flex flex-col items-center">
                        <PartyLogo
                          party_id={request.receiverPartyId}
                          size={48}
                        />
                        <span className="text-xs text-muted-foreground mt-1">
                          {request.receiverPartyName}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      Proposed: {request.mergedPartyName}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {request.mergedPartyBio}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <span>
                      ⏳ Waiting for response from {request.receiverPartyName}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleCancel(request.mergeRequestId)}
                    disabled={processing !== null}
                    className="w-full"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Request
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateRequestTab({
  party,
  allParties,
  stances,
  receivedRequests,
  sentRequests,
}: {
  party: any;
  allParties: Array<any>;
  stances: Array<any>;
  receivedRequests: Array<any>;
  sentRequests: Array<any>;
}) {
  const [leaning, setLeaning] = useState([3]);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [stanceValues, setStanceValues] = useState<Record<number, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedTargetParty, setSelectedTargetParty] = useState<number | null>(
    null,
  );

  // Filter out current party and parties with pending requests
  const partiesWithPendingRequests = new Set([
    ...receivedRequests.map((r) => r.senderPartyId),
    ...sentRequests.map((r) => r.receiverPartyId),
  ]);

  const availableParties = allParties.filter(
    (p) => p.id !== party.id && !partiesWithPendingRequests.has(p.id),
  );

  const form = useForm({
    defaultValues: {
      name: "",
      color: "#ff0000",
      bio: "",
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      if (!selectedTargetParty) {
        setSubmitError("Please select a target party");
        return;
      }

      const stanceEntries = Object.entries(stanceValues).filter(
        ([_, val]) => val.trim() !== "",
      );

      try {
        await createMergeRequest({
          data: {
            senderPartyId: party.id,
            receiverPartyId: selectedTargetParty,
            mergedPartyData: {
              name: value.name,
              color: value.color,
              bio: value.bio,
              leaning: leanings[leaning[0]],
              logo: selectedLogo,
            },
            stances: stanceEntries.map(([id, val]) => ({
              stanceId: Number(id),
              value: val,
            })),
          },
        });
        window.location.reload();
      } catch (error) {
        console.error("Error creating merge request:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to create merge request. Please try again.";
        setSubmitError(errorMessage);
      }
    },
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-6"
        >
          {/* Target Party Selection */}
          <div className="space-y-2">
            <Label className="text-lg font-medium text-foreground">
              Target Party<span className="text-red-500">*</span>
            </Label>
            <div className="grid gap-3">
              {availableParties.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 border rounded-md">
                  No parties available for merging. All parties either have
                  pending requests or you're already in their party.
                </p>
              ) : (
                availableParties.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedTargetParty(p.id)}
                    className={`flex items-center gap-4 p-4 border rounded-md hover:bg-accent transition-colors ${
                      selectedTargetParty === p.id
                        ? "ring-2 ring-primary bg-accent"
                        : ""
                    }`}
                  >
                    <PartyLogo party_id={p.id} size={48} />
                    <div className="flex-1 text-left">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {p.memberCount} members
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Party Name */}
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.trim().length === 0) {
                  return "Party name is required";
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="grid grid-cols-1 gap-2">
                <Label
                  htmlFor={field.name}
                  className="text-lg font-medium text-foreground"
                >
                  Merged Party Name<span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Name for the new merged party"
                />
                {field.state.meta.errors.length > 0 && (
                  <span className="text-sm text-red-500">
                    {field.state.meta.errors.join(", ")}
                  </span>
                )}
              </div>
            )}
          </form.Field>

          {/* Party Color */}
          <form.Field
            name="color"
            validators={{
              onChange: ({ value }) => {
                if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
                  return "Invalid color format";
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="grid grid-cols-1 gap-2">
                <Label
                  htmlFor={field.name}
                  className="text-lg font-medium text-foreground"
                >
                  Party Color<span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="#ff0000"
                    className="flex-1"
                  />
                </div>
                {field.state.meta.errors.length > 0 && (
                  <span className="text-sm text-red-500">
                    {field.state.meta.errors.join(", ")}
                  </span>
                )}
              </div>
            )}
          </form.Field>

          {/* Party Bio */}
          <form.Field
            name="bio"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.trim().length === 0) {
                  return "Party bio is required";
                }
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="grid grid-cols-1 gap-2">
                <Label
                  htmlFor={field.name}
                  className="text-lg font-medium text-foreground"
                >
                  Party Bio<span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Brief description of the merged party"
                  className="min-h-20"
                />
                {field.state.meta.errors.length > 0 && (
                  <span className="text-sm text-red-500">
                    {field.state.meta.errors.join(", ")}
                  </span>
                )}
              </div>
            )}
          </form.Field>

          {/* Party Logo */}
          <div className="space-y-6">
            <Label className="text-lg font-medium text-foreground">
              Party Logo
            </Label>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedLogo(null)}
                className={`flex items-center justify-center w-14 h-14 rounded-md border p-2 text-sm hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  selectedLogo === null
                    ? "ring-2 ring-offset-2 ring-primary"
                    : ""
                }`}
                aria-pressed={selectedLogo === null}
                title="None"
              >
                None
              </button>

              {icons.map((ic) => {
                const IconComp = ic.Icon;
                return (
                  <button
                    key={ic.name}
                    type="button"
                    onClick={() => setSelectedLogo(ic.name)}
                    className={`flex items-center justify-center w-14 h-14 rounded-md border p-2 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      selectedLogo === ic.name
                        ? "ring-2 ring-offset-2 ring-primary"
                        : ""
                    }`}
                    aria-pressed={selectedLogo === ic.name}
                    title={ic.name}
                  >
                    <IconComp className="w-6 h-6" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Political Leaning */}
          <div>
            <Label className="block text-center mb-8">
              <span className="text-lg font-medium">Political Leaning: </span>
              <span className="font-sm">{leanings[leaning[0]]}</span>
            </Label>

            <div className="relative px-2">
              <Slider
                value={leaning}
                onValueChange={setLeaning}
                max={6}
                step={1}
                className="cursor-pointer"
              />

              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                {leanings.map((_, i) => (
                  <span key={i} className="text-center w-12">
                    {i === 0
                      ? "Far Left"
                      : i === 6
                        ? "Far Right"
                        : i - 3 === 0
                          ? "Center"
                          : ""}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Party Stances */}
          {stances &&
            stances.length > 0 &&
            stances.map((stance) => (
              <div className="grid grid-cols-1 gap-2" key={stance.id}>
                <Label
                  htmlFor={`stance-${stance.id}`}
                  className="text-lg font-medium text-foreground"
                >
                  {stance.issue}
                </Label>
                <Textarea
                  id={`stance-${stance.id}`}
                  value={stanceValues[stance.id] || ""}
                  onChange={(e) =>
                    setStanceValues((prev) => ({
                      ...prev,
                      [stance.id]: e.target.value,
                    }))
                  }
                  placeholder={stance.description}
                  className="min-h-20"
                />
              </div>
            ))}

          {/* Submit Error */}
          {submitError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          {/* Submit Button */}
          <form.Subscribe
            selector={(state) => [state.isSubmitting, state.canSubmit]}
          >
            {([isSubmitting, canSubmit]) => (
              <Button
                type="submit"
                className="w-full py-3"
                disabled={
                  isSubmitting ||
                  !canSubmit ||
                  !selectedTargetParty ||
                  availableParties.length === 0
                }
              >
                {isSubmitting ? "Sending Request..." : "Send Merge Request"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
