import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createParty } from "@/lib/server/party";
import { leanings } from "@/lib/constants";
import { icons } from "@/lib/utils/logo-helper";

export function NewPartyDialog({
  user,
  stances,
  autoOpen = false,
}: {
  user: { id: number; partyId: number | null } | null;
  stances: Array<{ id: number; issue: string; description: string }>;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [color, setColor] = useState("#475569");
  const [discord, setDiscord] = useState("");
  const [logo, setLogo] = useState("");
  const [leaning, setLeaning] = useState("Center");
  const [positions, setPositions] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) return setError("Sign in to create a party.");
    if (user.partyId) return setError("Leave your current party first.");
    if (!name.trim() || !bio.trim())
      return setError("A party name and biography are required.");
    if (discord) {
      try {
        new URL(discord);
      } catch {
        return setError("Enter a valid Discord URL.");
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const party = await createParty({
        data: {
          party: {
            name: name.trim(),
            leader_id: user.id,
            bio: bio.trim(),
            color,
            discord: discord.trim() || null,
            logo: logo || null,
            leaning,
          },
          stances: Object.entries(positions)
            .filter(([, value]) => value.trim())
            .map(([stanceId, value]) => ({
              stanceId: Number(stanceId),
              value: value.trim(),
            })),
        },
      });
      setOpen(false);
      await router.navigate({
        to: "/dashboard/parties/$partyId",
        params: { partyId: String(party.id) },
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create party",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={Boolean(user?.partyId)}>
          Create party
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto rounded-sm sm:max-w-3xl">
        <DialogHeader className="border-b pb-4">
          <p className="wiki-kicker">Political organization</p>
          <DialogTitle className="font-serif text-3xl">
            Create a party
          </DialogTitle>
          <DialogDescription>
            Establish the party identity, community details, and public
            platform.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="party-name">Name</Label>
            <Input
              id="party-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="party-bio">Biography</Label>
            <Textarea
              id="party-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="party-color">Color</Label>
            <div className="flex gap-2">
              <Input
                id="party-color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                maxLength={7}
              />
              <Input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="w-12 p-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="party-leaning">Political position</Label>
            <select
              id="party-leaning"
              value={leaning}
              onChange={(event) => setLeaning(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {leanings.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="party-discord">Discord invite</Label>
            <Input
              id="party-discord"
              type="url"
              value={discord}
              onChange={(event) => setDiscord(event.target.value)}
              placeholder="https://discord.gg/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="party-logo">Logo</Label>
            <select
              id="party-logo"
              value={logo}
              onChange={(event) => setLogo(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">No logo</option>
              {icons.map((icon) => (
                <option key={icon.name}>{icon.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-4 border-t pt-5 sm:col-span-2">
            <div>
              <h3 className="font-serif text-xl font-bold">Platform</h3>
              <p className="text-sm text-muted-foreground">
                Optional public positions on the recognized policy issues.
              </p>
            </div>
            {stances.map((stance) => (
              <div key={stance.id} className="space-y-2">
                <Label htmlFor={`new-party-stance-${stance.id}`}>
                  {stance.issue}
                </Label>
                <Textarea
                  id={`new-party-stance-${stance.id}`}
                  value={positions[stance.id] ?? ""}
                  onChange={(event) =>
                    setPositions((current) => ({
                      ...current,
                      [stance.id]: event.target.value,
                    }))
                  }
                  placeholder={stance.description}
                  rows={3}
                />
              </div>
            ))}
          </div>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Creating..." : "Create party"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
