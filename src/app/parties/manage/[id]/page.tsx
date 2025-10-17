/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import withAuth from "@/lib/withAuth";
import { useRouter, useParams } from "next/navigation";
import React, { useState, useEffect, FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
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

export const leanings = [
  "Far Left",
  "Left",
  "Center Left",
  "Center",
  "Center Right",
  "Right",
  "Far Right",
];

function ManageParty() {
  const [user] = useAuthState(auth);
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const [leaning, setLeaning] = useState([3]);

  // Get user info
  const { data: thisUser } = useQuery({
    queryKey: ["user", user?.email],
    queryFn: () =>
      fetchUserInfo(user?.email || "").then((data) => data || null),
    enabled: !!user?.email,
  });

  // Party info
  const { data: party, isLoading: partyLoading } = useQuery({
    queryKey: ["party", id],
    queryFn: async () => {
      const response = await axios.get("/api/get-party-by-id", {
        params: { partyId: id },
      });
      return response.data;
    },
    enabled: !!id,
  });

  // Get stance types
  const { data: stances } = useQuery({
    queryKey: ["stances"],
    queryFn: async () => {
      const res = await axios.get("/api/get-stance-types");
      const stances = res.data || [];
      return stances.types;
    },
  });

  useEffect(() => {
    if (party?.leaning) {
      const leaningIndex = leanings.indexOf(party.leaning);
      if (leaningIndex !== -1) {
        setLeaning([leaningIndex]);
      }
    }
  }, [party]);

  const submitHandler = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!thisUser?.id) return;

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement)?.value;
    const color = (form.elements.namedItem("color") as HTMLInputElement)?.value;
    const bio = (form.elements.namedItem("bio") as HTMLInputElement)?.value;
    const leaningValue = leanings[leaning[0]];

    if (bio === "" || name === "" || color === "") {
      toast.error("Please fill in all required fields.");
      return;
    }

    const stanceValues: { id: number; value: string }[] = [];
    stances.forEach((stance: any) => {
      stanceValues.push({
        id: stance.id,
        value: (form.elements.namedItem(stance.id) as HTMLInputElement)?.value,
      });
    });

    try {
      const response = await axios.post("/api/party-update", {
        partyId: id,
        userId: thisUser.id,
        name,
        color,
        bio,
        stanceValues,
        leaningValue,
      });
      toast.success("Party updated successfully!");
      router.push(`/parties/${id}`);
    } catch (error) {
      toast.error("Error updating party");
      console.error("Error updating party:", error);
    }
  };

  const loading = partyLoading;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Manage Party
        </h1>
        <p className="text-muted-foreground">
          Edit your party's information here.
        </p>
      </div>
      {loading ? (
        <GenericSkeleton />
      ) : (
        <div className="mx-auto bg-card p-8 rounded-lg shadow space-y-8">
          <form className="space-y-8" onSubmit={submitHandler}>
            <div className="grid grid-cols-1 gap-2">
              <Label
                htmlFor="name"
                className="text-lg font-medium text-foreground"
              >
                Party Name<span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                id="name"
                placeholder="Enter party name"
                defaultValue={party?.name || ""}
              />
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Label
                htmlFor="color"
                className="text-lg font-medium text-foreground"
              >
                Party Color<span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="text"
                  id="color"
                  placeholder="#ff0000"
                  defaultValue={party?.color || "#ff0000"}
                  maxLength={7}
                  pattern="^#([A-Fa-f0-9]{6})$"
                  className="w-full"
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
                  defaultValue={party?.color || "#ff0000"}
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
            <div className="grid grid-cols-1 gap-2">
              <Label
                htmlFor="bio"
                className="text-lg font-medium text-foreground"
              >
                Party Bio<span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="bio"
                placeholder="Brief description of your party"
                className="min-h-[80px]"
                defaultValue={party?.bio || ""}
              />
            </div>
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
                  {leanings.map((label, i) => (
                    <span key={i} className="text-center w-12 ">
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
              stances.map((stance: any) => {
                // Find the matching stance value from party data
                const partyStance = party?.stances?.find(
                  (s: any) => s.id === stance.id
                );
                return (
                  <div className="grid grid-cols-1 gap-2" key={stance.id}>
                    <Label
                      htmlFor={stance.id}
                      className="text-lg font-medium text-foreground"
                    >
                      {stance.issue}
                    </Label>
                    <Textarea
                      id={stance.id}
                      placeholder={stance.description}
                      className="min-h-[80px]"
                      defaultValue={partyStance?.value || ""}
                    />
                  </div>
                );
              })}
            <Button type="submit" className="w-full py-3">
              Update Party
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

export default withAuth(ManageParty);
