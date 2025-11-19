"use client";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { toast } from "sonner";
import { icons } from "@/app/utils/logoHelper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { auth } from "@/lib/firebase";
import { trpc } from "@/lib/trpc";
import withAuth from "@/lib/withAuth";

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

  const { data: thisUser } = trpc.user.getByEmail.useQuery(
    { email: user?.email || "" },
    { enabled: !!user?.email },
  );

  const { data: stances = [] } = trpc.party.stanceTypes.useQuery();

  const createParty = trpc.party.create.useMutation({
    onError: (err) => {
      toast.error(err?.message || "Failed to create party");
    },
  });

  const addFeed = trpc.feed.add.useMutation({
    onError: () => {
      // Non-blocking: do not toast as error here to avoid interrupting flow
      // You can add a warning if desired
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

    if (!name || !bio || !color) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const stanceValues: { id: number; value: string }[] = [];
    stances.forEach((stance) => {
      stanceValues.push({
        id: stance.id,
        value: (form.elements.namedItem(stance.id) as HTMLInputElement)?.value,
      });
    });

    try {
      const result = await createParty.mutateAsync({
        name,
        color,
        bio,
        stanceValues,
        leaning: leanings[leaning[0]],
        logo: selectedLogo || null,
        discord: discord || null,
      });

      await addFeed.mutateAsync({
        content: `has created a new party: ${name}`,
      });
      router.push(`/parties/${result.id}`);
    } catch (error) {
      throw new Error(`Error creating party:${error}`);
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
                    "color-picker",
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
                    "color",
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
                  <span key={label} className="text-center w-12 ">
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
            stances.map((stance) => (
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
