/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import withAuth from "@/lib/withAuth";
import { fetchUserInfo } from "@/app/utils/userHelper";
import axios from "axios";
import React from "react";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { icons } from "@/app/utils/logoHelper";

export const leanings = [
  "Far Left",
  "Left",
  "Center Left",
  "Center",
  "Center Right",
  "Right",
  "Far Right",
];

function Home() {
  const [user] = useAuthState(auth);
  const router = useRouter();
  const [leaning, setLeaning] = React.useState([3]);

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

  const { data: stances } = useQuery({
    queryKey: ["stances"],
    queryFn: async () => {
      const res = await axios.get("/api/get-stance-types");
      const stances = res.data || [];
      console.log(stances.types);
      return stances.types;
    },
  });

  const submitHandler = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!thisUser?.id) return;

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement)?.value;
    const color = (form.elements.namedItem("color") as HTMLInputElement)?.value;
    const bio = (form.elements.namedItem("bio") as HTMLInputElement)?.value;
    const discord = (
      form.elements.namedItem("discord_link") as HTMLInputElement
    )?.value;
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
      const response = await axios.post("/api/party-create", {
        userId: thisUser.id,
        name,
        color,
        bio,
        stanceValues,
        leaningValue,
        logo: selectedLogo || null,
        discord: discord || null,
      });
      router.push(`/parties/${response.data.id}`);
    } catch (error) {
      throw new Error("Error creating party:" + error);
    }
    try {
      await axios.post("/api/feed-add", {
        userId: thisUser.id,
        content: `has created a new party: ${name}`,
      });
    } catch (error) {
      throw new Error("Error creating feed item:" + error);
    }
  };

  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Create a Political Party
        </h1>
        <p className="text-muted-foreground">
          Create your own political party and start gathering supporters!
        </p>
      </div>
      <div className="mx-auto bg-card p-8 rounded-lg shadow space-y-8">
        <form className="space-y-8" onSubmit={submitHandler}>
          <div className="grid grid-cols-1 gap-2">
            <Label
              htmlFor="name"
              className="text-lg font-medium text-foreground"
            >
              Party Name<span className="text-red-500">*</span>
            </Label>
            <Input type="text" id="name" placeholder="Enter party name" />
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
                defaultValue="#ff0000"
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
            />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Label
              htmlFor="discord_link"
              className="text-lg font-medium text-foreground"
            >
              Discord Invite Link
            </Label>
            <Input
              type="url"
              id="discord_link"
              placeholder="https://discord.gg/..."
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
            stances &&
            stances.length > 0 &&
            stances.map((stance: any) => (
              <div className="grid grid-cols-1 gap-2" key={stance.id}>
                <Label
                  htmlFor="bio"
                  className="text-lg font-medium text-foreground"
                >
                  {stance.issue}
                </Label>
                <Textarea
                  id={stance.id}
                  placeholder={stance.description}
                  className="min-h-[80px]"
                />
              </div>
            ))}
          <Button type="submit" className="w-full py-3">
            Create Party
          </Button>
        </form>
      </div>
    </div>
  );
}

export default withAuth(Home);
