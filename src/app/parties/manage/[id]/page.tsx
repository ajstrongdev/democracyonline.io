"use client";

import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { toast } from "sonner";
import { icons } from "@/app/utils/logoHelper";
import GenericSkeleton from "@/components/genericskeleton";
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

function ManageParty() {
  const [user] = useAuthState(auth);
  const router = useRouter();
  const params = useParams();
  const utils = trpc.useUtils();
  const id = Number(params.id);
  const [leaning, setLeaning] = useState([3]);

  // Get user info
  const { data: thisUser } = trpc.user.getByEmail.useQuery(
    { email: user?.email || "" },
    { enabled: !!user?.email },
  );

  // Party info
  const { data: party, isLoading: partyLoading } = trpc.party.getById.useQuery(
    { partyId: id },
    { enabled: !!id },
  );

  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
  const [_colorState, setColorState] = useState<string>("#ff0000");

  // initialize selected logo and color when party loads
  useEffect(() => {
    if (party?.logo) setSelectedLogo(party.logo);
    if (party?.color) setColorState(party.color);
  }, [party]);

  // Get stance types
  const { data: stances = [] } = trpc.party.stanceTypes.useQuery();

  useEffect(() => {
    if (party?.leaning) {
      const leaningIndex = leanings.indexOf(party.leaning);
      if (leaningIndex !== -1) {
        setLeaning([leaningIndex]);
      }
    }
  }, [party]);

  const updateParty = trpc.party.update.useMutation({
    onSuccess: async () => {
      toast.success("Party updated successfully!");

      // Cancel any in-flight queries for this party (avoid refetch race/errors)
      await utils.party.getById.cancel({ partyId: id });
      await utils.party.members.cancel({ partyId: id });

      // Invalidate detail before navigation so the new page refetches fresh data
      await utils.party.getById.invalidate({ partyId: id });

      // Refresh listings if you show parties elsewhere
      await utils.party.list.invalidate();

      // Navigate back to the party page
      router.push(`/parties/${id}`);
    },
    onError: (err) => {
      toast.error(err?.message || "Error updating party");
      console.error("Error updating party:", err);
    },
  });

  const submitHandler = async (e: FormEvent<HTMLFormElement>) => {
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

    if (!name || !color || !bio) {
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

    // Fire mutation; onSuccess handles toast, cache, and navigation
    updateParty.mutate({
      partyId: id,
      name,
      color,
      bio,
      stanceValues,
      leaning: leaningValue,
      logo: selectedLogo || null,
      discord: discord || null,
    });
  };

  const loading = partyLoading;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Manage Party
        </h1>
        <p className="text-muted-foreground">
          Edit your party&apos;s information here.
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
                  defaultValue={party?.color || "#ff0000"}
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
                defaultValue={party?.bio || ""}
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
                defaultValue={party?.discord || ""}
              />
            </div>
            <div className="grid grid-cols-1 gap-2">
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
              stances.length > 0 &&
              stances.map((stance) => {
                // Find the matching stance value from party data
                const partyStance = party?.stances?.find(
                  (s) => s.id === stance.id,
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
