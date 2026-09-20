import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
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
import { leanings } from "@/lib/constants";
import { updateParty } from "@/lib/server/party";
import { icons } from "@/lib/utils/logo-helper";

type ManagedParty = {
  id: number;
  name: string;
  color: string;
  bio: string | null;
  discord: string | null;
  logo: string | null;
  leaning: string | null;
};

export function ManagePartyDialog({ party }: { party: ManagedParty }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(party.name);
  const [bio, setBio] = useState(party.bio ?? "");
  const [color, setColor] = useState(party.color);
  const [discord, setDiscord] = useState(party.discord ?? "");
  const [logo, setLogo] = useState(party.logo ?? "");
  const [leaning, setLeaning] = useState(party.leaning ?? "Center");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await updateParty({
        data: {
          party: {
            id: party.id,
            name: name.trim(),
            bio: bio.trim(),
            color,
            discord: discord.trim() || null,
            logo: logo || null,
            leaning,
          },
        },
      });
      setOpen(false);
      toast.success("Party details updated");
      await router.invalidate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update party",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" className="h-auto p-0">
          Manage <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto rounded-sm sm:max-w-2xl">
        <DialogHeader className="border-b pb-4">
          <p className="wiki-kicker">Party leadership</p>
          <DialogTitle className="font-serif text-3xl">
            Manage party
          </DialogTitle>
          <DialogDescription>
            Update the party identity and community details. Edit the platform
            directly on the wiki page.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="manage-party-name">Name</Label>
            <Input
              id="manage-party-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="manage-party-bio">Biography</Label>
            <Textarea
              id="manage-party-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manage-party-color">Color</Label>
            <div className="flex gap-2">
              <Input
                id="manage-party-color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                maxLength={7}
                pattern="^#[0-9A-Fa-f]{6}$"
                required
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
            <Label htmlFor="manage-party-leaning">Political position</Label>
            <select
              id="manage-party-leaning"
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
            <Label htmlFor="manage-party-discord">Discord invite</Label>
            <Input
              id="manage-party-discord"
              type="url"
              value={discord}
              onChange={(event) => setDiscord(event.target.value)}
              placeholder="https://discord.gg/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manage-party-logo">Logo</Label>
            <select
              id="manage-party-logo"
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
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || !name.trim() || !bio.trim()}
          >
            {submitting ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
