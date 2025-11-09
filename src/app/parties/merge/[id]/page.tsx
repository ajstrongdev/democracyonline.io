/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import withAuth from "@/lib/withAuth";
import { useRouter, useParams } from "next/navigation";
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { fetchUserInfo } from "@/app/utils/userHelper";
import axios from "axios";
import GenericSkeleton from "@/components/genericskeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { icons } from "@/app/utils/logoHelper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PartyLogo from "@/components/PartyLogo";

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
  const [user] = useAuthState(auth);
  const router = useRouter();
  const params = useParams();
  const id = params.id; // This is the current party ID
  const queryClient = useQueryClient();
  const [leaning, setLeaning] = useState([3]);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [selectedTargetPartyId, setSelectedTargetPartyId] = useState<
    number | null
  >(null);
  const [activeTab, setActiveTab] = useState("view");

  // Get current user info
  const { data: thisUser } = useQuery({
    queryKey: ["user", user?.email],
    queryFn: async () => {
      if (user && user.email) {
        const userDetails = await fetchUserInfo(user.email);
        return userDetails || null;
      }
      return null;
    },
    enabled: !!user?.email,
  });

  // Get current party info
  const { data: currentParty, isLoading: partyLoading } = useQuery({
    queryKey: ["party", id],
    queryFn: async () => {
      const response = await axios.get("/api/get-party-by-id", {
        params: { partyId: id },
      });
      return response.data;
    },
    enabled: !!id,
  });

  const { data: allParties = [] } = useQuery({
    queryKey: ["allParties"],
    queryFn: async () => {
      const response = await axios.get("/api/party-list");
      return response.data;
    },
  });

  const { data: stances } = useQuery({
    queryKey: ["stances"],
    queryFn: async () => {
      const res = await axios.get("/api/get-stance-types");
      return res.data?.types || [];
    },
  });

  const { data: mergeRequests = [], isLoading: mergeRequestsLoading } =
    useQuery({
      queryKey: ["mergeRequests", id],
      queryFn: async () => {
        const response = await axios.get("/api/party-merge-requests-get", {
          params: { partyId: id },
        });
        return response.data;
      },
      enabled: !!id,
    });

  // Get sent merge requests from this party (as sender)
  const { data: sentMergeRequests = [] } = useQuery({
    queryKey: ["sentMergeRequests", id],
    queryFn: async () => {
      const response = await axios.get("/api/party-merge-requests-sent", {
        params: { partyId: id },
      });
      return response.data;
    },
    enabled: !!id,
  });

  const handleCreateMergeRequest = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    if (!thisUser?.id || !currentParty?.id) {
      toast.error("User or party information is missing");
      return;
    }

    if (!selectedTargetPartyId) {
      toast.error("Please select a target party to merge with");
      return;
    }

    const existingRequest = sentMergeRequests.find(
      (req: any) => req.receiverParty?.id === selectedTargetPartyId
    );

    if (existingRequest) {
      toast.error("A merge request has already been sent to this party");
      return;
    }

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement)?.value;
    const color = (form.elements.namedItem("color") as HTMLInputElement)?.value;
    const bio = (form.elements.namedItem("bio") as HTMLInputElement)?.value;
    const leaningValue = leanings[leaning[0]];

    if (!bio || !name || !color) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const stanceValues: { id: number; value: string }[] = [];
    stances?.forEach((stance: any) => {
      stanceValues.push({
        id: stance.id,
        value:
          (form.elements.namedItem(stance.id) as HTMLInputElement)?.value || "",
      });
    });

    try {
      await axios.post("/api/party-merge-request-create", {
        senderPartyId: currentParty.id,
        receiverPartyId: selectedTargetPartyId,
        mergedPartyData: {
          name,
          color,
          bio,
          leaning: leaningValue,
          logo: selectedLogo || null,
          stanceValues,
        },
      });
      toast.success("Merge request sent successfully!");
      queryClient.invalidateQueries({ queryKey: ["mergeRequests", id] });
      queryClient.invalidateQueries({ queryKey: ["sentMergeRequests", id] });
      queryClient.invalidateQueries({ queryKey: ["mergeRequestCount", id] });
      form.reset();
      setLeaning([3]);
      setSelectedLogo(null);
      setSelectedTargetPartyId(null);
      // Switch back to view tab
      setActiveTab("view");
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Error creating merge request"
      );
    }
  };

  const handleAcceptMergeRequest = async (mergeRequestId: number) => {
    try {
      const response = await axios.post("/api/party-merge-request-accept", {
        mergeRequestId,
        partyId: id,
      });
      toast.success("Merge request accepted! Parties have been merged.");
      queryClient.invalidateQueries({ queryKey: ["mergeRequests", id] });
      queryClient.invalidateQueries({ queryKey: ["party", id] });
      queryClient.invalidateQueries({ queryKey: ["user", user?.email] });
      queryClient.invalidateQueries({ queryKey: ["allParties"] });
      if (response.data.newPartyId) {
        router.push(`/parties/${response.data.newPartyId}`);
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Error accepting merge request"
      );
    }
  };

  const handleRejectMergeRequest = async (mergeRequestId: number) => {
    try {
      await axios.post("/api/party-merge-request-reject", {
        mergeRequestId,
        partyId: id,
      });
      toast.success("Merge request rejected");
      queryClient.invalidateQueries({ queryKey: ["mergeRequests", id] });
      queryClient.invalidateQueries({ queryKey: ["mergeRequestCount", id] });
      // Redirect back to party page
      router.push(`/parties/${id}`);
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Error rejecting merge request"
      );
    }
  };

  const isLeader = currentParty?.leader_id === thisUser?.id;

  if (partyLoading || !thisUser) {
    return <GenericSkeleton />;
  }

  if (!isLeader) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="text-center py-12">
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Access Denied
            </h2>
            <p className="text-muted-foreground mb-4">
              Only the party leader can manage merge requests.
            </p>
            <Button onClick={() => router.push(`/parties/${id}`)}>
              ← Back to Party
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const partiesWithPendingRequests = sentMergeRequests.map(
    (req: any) => req.receiverParty?.id
  );

  const availableParties = allParties.filter(
    (party: any) =>
      party.id !== Number(id) && !partiesWithPendingRequests.includes(party.id)
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Party merging
        </h1>
        <p className="text-muted-foreground">
          Create and manage merge requests for your party.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="view">Notifications</TabsTrigger>
          <TabsTrigger value="create">Create Merge Request</TabsTrigger>
        </TabsList>

        <TabsContent value="view" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Incoming Merge Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {mergeRequestsLoading ? (
                  <GenericSkeleton />
                ) : mergeRequests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No incoming merge requests at this time.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {mergeRequests.map((request: any) => (
                      <Card
                        key={request.id}
                        className="border-l-4"
                        style={{ borderLeftColor: request.mergeData?.color }}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-xl font-bold mb-2">
                                {request.mergeData?.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                From: {request.senderParty?.name}
                              </p>
                            </div>
                            {request.mergeData?.logo && (
                              <PartyLogo party_id={request.id} size={60} />
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <h4 className="font-semibold mb-1">Description</h4>
                            <p className="text-sm text-muted-foreground">
                              {request.mergeData?.bio}
                            </p>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-semibold mb-1">
                                Party Color
                              </h4>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-6 h-6 rounded-full border"
                                  style={{
                                    backgroundColor: request.mergeData?.color,
                                  }}
                                />
                                <span className="font-mono text-sm">
                                  {request.mergeData?.color}
                                </span>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-1">
                                Political Leaning
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {request.mergeData?.leaning}
                              </p>
                            </div>
                          </div>
                          {request.mergeData?.stances &&
                            request.mergeData.stances.length > 0 && (
                              <div>
                                <h4 className="font-semibold mb-2">
                                  Party Platform
                                </h4>
                                <div className="space-y-2">
                                  {request.mergeData.stances.map(
                                    (stance: any, idx: number) => (
                                      <div key={idx} className="text-sm">
                                        <span className="font-medium">
                                          {stance.issue}:
                                        </span>{" "}
                                        <span className="text-muted-foreground">
                                          {stance.value}
                                        </span>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                          <div className="flex gap-2 pt-4">
                            <Button
                              onClick={() =>
                                handleAcceptMergeRequest(request.id)
                              }
                              className="flex-1"
                            >
                              Accept Merge
                            </Button>
                            <Button
                              onClick={() =>
                                handleRejectMergeRequest(request.id)
                              }
                              variant="destructive"
                              className="flex-1"
                            >
                              Reject
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sent Merge Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {sentMergeRequests.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    You have sent no merge requests.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {sentMergeRequests.map((request: any) => (
                      <Card
                        key={request.id}
                        className="border-l-4"
                        style={{ borderLeftColor: request.mergeData?.color }}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-xl font-bold mb-2">
                                {request.mergeData?.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                To: {request.receiverParty?.name}
                              </p>
                              <p className="text-sm text-amber-600 mt-1">
                                Status: Pending Response
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <h4 className="font-semibold mb-1">Description</h4>
                            <p className="text-sm text-muted-foreground">
                              {request.mergeData?.bio}
                            </p>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-semibold mb-1">
                                Party Color
                              </h4>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-6 h-6 rounded-full border"
                                  style={{
                                    backgroundColor: request.mergeData?.color,
                                  }}
                                />
                                <span className="font-mono text-sm">
                                  {request.mergeData?.color}
                                </span>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-1">
                                Political Leaning
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {request.mergeData?.leaning}
                              </p>
                            </div>
                          </div>
                          {request.mergeData?.stances &&
                            request.mergeData.stances.length > 0 && (
                              <div>
                                <h4 className="font-semibold mb-2">
                                  Party Platform
                                </h4>
                                <div className="space-y-2">
                                  {request.mergeData.stances.map(
                                    (stance: any, idx: number) => (
                                      <div key={idx} className="text-sm">
                                        <span className="font-medium">
                                          {stance.issue}:
                                        </span>{" "}
                                        <span className="text-muted-foreground">
                                          {stance.value}
                                        </span>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Merge Request</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateMergeRequest} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="targetParty" className="text-lg font-medium">
                    Select Target Party<span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="targetParty"
                    value={selectedTargetPartyId || ""}
                    onChange={(e) =>
                      setSelectedTargetPartyId(Number(e.target.value))
                    }
                    className="w-full p-2 border rounded-md bg-background text-foreground"
                    required
                  >
                    <option value="">-- Select a party to merge with --</option>
                    {availableParties.map((party: any) => (
                      <option key={party.id} value={party.id}>
                        {party.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-muted-foreground">
                    Choose which party you want to send a merge request to.
                  </p>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Merged Party Details
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Define how the new merged party will look like.
                  </p>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-lg font-medium">
                        Party Name<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        id="name"
                        placeholder="Enter merged party name"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="color" className="text-lg font-medium">
                        Party Color<span className="text-red-500">*</span>
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="text"
                          id="color"
                          placeholder="#ff0000"
                          defaultValue="#ff0000"
                          maxLength={7}
                          pattern="^#([A-Fa-f0-9]{6})$"
                          className="w-full"
                          required
                          onChange={(e) => {
                            const colorPicker = document.getElementById(
                              "color-picker"
                            ) as HTMLInputElement;
                            if (
                              colorPicker &&
                              /^#([A-Fa-f0-9]{6})$/.test(e.target.value)
                            ) {
                              colorPicker.value = e.target.value;
                            }
                          }}
                        />
                        <Input
                          type="color"
                          id="color-picker"
                          defaultValue="#ff0000"
                          className="w-10 p-0 border-0"
                          onChange={(e) => {
                            const hexInput = document.getElementById(
                              "color"
                            ) as HTMLInputElement;
                            if (hexInput) hexInput.value = e.target.value;
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio" className="text-lg font-medium">
                        Party Bio<span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="bio"
                        placeholder="Brief description of the merged party"
                        className="min-h-[80px]"
                        required
                      />
                    </div>

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

                    <div>
                      <Label className="block text-center mb-8">
                        <span className="text-lg font-medium">
                          Political Leaning:{" "}
                        </span>
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
                          {leanings.map((label, i) => (
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

                    {stances &&
                      stances.length > 0 &&
                      stances.map((stance: any) => (
                        <div className="space-y-2" key={stance.id}>
                          <Label
                            htmlFor={String(stance.id)}
                            className="text-lg font-medium text-foreground"
                          >
                            {stance.issue}
                          </Label>
                          <Textarea
                            id={String(stance.id)}
                            placeholder={stance.description}
                            className="min-h-[80px]"
                          />
                        </div>
                      ))}

                    <Button type="submit" className="w-full py-3">
                      Send Merge Request
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(MergePartyPage);
