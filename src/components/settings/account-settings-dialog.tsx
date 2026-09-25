import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { toast } from "sonner";
import { InvitationManager } from "@/components/settings/invitation-manager";
import { AvatarEditor } from "@/components/players/avatar-editor";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { ReferenceInsert } from "@/components/reference-insert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { leanings } from "@/lib/constants";
import { renderAvatar } from "@/lib/avatar";
import { useAuth } from "@/lib/auth-context";
import { getCurrentUserInfo, updateUserProfile } from "@/lib/server/users";

type Player = NonNullable<Awaited<ReturnType<typeof getCurrentUserInfo>>>;

export function AccountSettingsDialog({
  open,
  onOpenChange,
  initialTab = "profile",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "profile" | "avatar" | "password" | "invites";
}) {
  const { user: firebaseUser } = useAuth();
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [leaning, setLeaning] = useState(3);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
    }
    onOpenChange(nextOpen);
  };

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setPlayer(null);
    getCurrentUserInfo()
      .then((result) => {
        if (!active) return;
        const profile = Array.isArray(result) ? result[0] : result;
        if (!profile) throw new Error("Player profile not found");
        setPlayer(profile);
        setUsername(profile.username);
        setBio(profile.bio ?? "");
        setPronouns(profile.pronouns ?? "");
        setLeaning(Math.max(0, leanings.indexOf(profile.politicalLeaning ?? "Center")));
      })
      .catch((error: unknown) => {
        if (active) toast.error(error instanceof Error ? error.message : "Could not load settings");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [open]);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!player) return;
    setSaving(true);
    try {
      await updateUserProfile({
        data: {
          userId: player.id,
          username: username.trim(),
          bio: bio.trim(),
          pronouns: pronouns.trim(),
          politicalLeaning: leanings[leaning],
        },
      });
      setPlayer({ ...player, username: username.trim(), bio: bio.trim(), pronouns: pronouns.trim(), politicalLeaning: leanings[leaning] });
      await router.invalidate();
      toast.success("Profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    if (!firebaseUser?.email) {
      setPasswordError("Sign in again to update your password");
      return;
    }
    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Could not update password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b bg-muted/30 px-5 py-5 text-left sm:px-7">
          <DialogTitle className="font-serif text-2xl">Account settings</DialogTitle>
          <DialogDescription>Manage your player profile and account.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="p-8 text-sm text-muted-foreground">Loading settings…</p>
        ) : !player ? (
          <p className="p-8 text-sm text-muted-foreground">Your player profile is unavailable.</p>
        ) : (
          <Tabs defaultValue={initialTab} className="min-h-0 flex-1 gap-0 overflow-hidden">
            <div className="flex items-center gap-3 border-b px-5 py-4 sm:px-7">
              <PlayerAvatar username={player.username} photoUrl={player.photoUrl} className="size-12" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{player.username}</p>
                <p className="text-xs text-muted-foreground">{player.role ?? "Citizen"} · {player.pronouns || "Player"}</p>
              </div>
            </div>
            <TabsList className="mx-5 mt-4 grid h-auto w-auto grid-cols-4 sm:mx-7">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="avatar">Avatar</TabsTrigger>
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="invites">Invites</TabsTrigger>
            </TabsList>
            <div className="min-h-0 overflow-y-auto px-5 pb-6 pt-4 sm:px-7">
              <TabsContent value="profile" className="mt-0">
                <form onSubmit={saveProfile} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="settings-username">Username</Label>
                    <Input id="settings-username" value={username} onChange={(event) => setUsername(event.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings-pronouns">Pronouns</Label>
                    <Input id="settings-pronouns" value={pronouns} onChange={(event) => setPronouns(event.target.value)} maxLength={80} placeholder="they/she" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="settings-bio">Bio</Label>
                      <ReferenceInsert textareaId="settings-bio" value={bio} onChange={setBio} />
                    </div>
                    <Textarea id="settings-bio" value={bio} onChange={(event) => setBio(event.target.value)} required rows={4} />
                  </div>
                  <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Political leaning</Label>
                      <span className="text-sm font-medium">{leanings[leaning]}</span>
                    </div>
                    <Slider min={0} max={6} step={1} value={[leaning]} onValueChange={([value]) => setLeaning(value)} aria-label="Political leaning" />
                  </div>
                  <Button type="submit" disabled={saving || !username.trim() || !bio.trim()}>{saving ? "Saving…" : "Save profile"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="avatar" className="mt-0">
                <AvatarEditor
                  key={player.id}
                  initialConfig={player.avatarConfig}
                  username={player.username}
                  onSaved={(config) => setPlayer((current) => current && ({ ...current, avatarConfig: config, photoUrl: renderAvatar(config) }))}
                />
              </TabsContent>
              <TabsContent value="password" className="mt-0">
                <form onSubmit={savePassword} className="space-y-5">
                  <p className="text-sm text-muted-foreground">Confirm your current password to choose a new one.</p>
                  <div className="space-y-2">
                    <Label htmlFor="settings-current-password">Current password</Label>
                    <Input id="settings-current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings-new-password">New password</Label>
                    <Input id="settings-new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={6} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings-confirm-password">Confirm new password</Label>
                    <Input id="settings-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                  </div>
                  {passwordError && <p role="alert" className="text-sm text-destructive">{passwordError}</p>}
                  <Button type="submit" disabled={saving}>{saving ? "Updating…" : "Update password"}</Button>
                </form>
              </TabsContent>
              <TabsContent value="invites" className="mt-0">
                <InvitationManager />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
