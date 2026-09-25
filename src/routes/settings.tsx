import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { getCurrentUserInfo, updateUserProfile } from "@/lib/server/users";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { leanings } from "@/lib/constants";
import { useAuth } from "@/lib/auth-context";
import { useUserData } from "@/lib/hooks/use-user-data";
import ProtectedRoute from "@/components/auth/protected-route";
import { InvitationManager } from "@/components/settings/invitation-manager";
import { ReferenceInsert } from "@/components/reference-insert";
import { PlayerAvatar } from "@/components/players/player-avatar";
import { AvatarEditor } from "@/components/players/avatar-editor";
import { WikiHeader } from "@/components/wiki/wiki-header";
import { WikiPage } from "@/components/wiki/wiki-layout";

export const Route = createFileRoute("/settings")({
  loader: async ({ context }) => {
    if (!context.auth.user?.email) {
      throw redirect({ to: "/login" });
    }

    const userData = await getCurrentUserInfo();

    const user = Array.isArray(userData) ? userData[0] : userData;

    if (!user) {
      throw redirect({ to: "/login" });
    }

    return { user };
  },
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { user: firebaseUser } = useAuth();
  const { user: userLoaderData } = Route.useLoaderData();
  const user = useUserData(userLoaderData);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Political leaning state
  const initialLeaningIndex = leanings.indexOf(
    user?.politicalLeaning || "Center",
  );
  const [leaning, setLeaning] = useState([
    initialLeaningIndex >= 0 ? initialLeaningIndex : 3,
  ]);

  const profileForm = useForm({
    defaultValues: {
      username: user?.username,
      bio: user?.bio || "",
      pronouns: user?.pronouns || "",
    },
    onSubmit: async ({ value }) => {
      try {
        await updateUserProfile({
          data: {
            userId: user?.id || 0,
            username: value.username || "",
            bio: value.bio,
            pronouns: value.pronouns,
            politicalLeaning: leanings[leaning[0]],
          },
        });
        setIsEditingProfile(false);
        // Navigate to profile to see updated data
        navigate({
          to: "/dashboard/players/$playerId",
          params: { playerId: String(user?.id || 0) },
        });
      } catch (error) {
        console.error("Error updating profile:", error);
        alert("Failed to update profile. Please try again.");
      }
    },
  });

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    // Validate passwords
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    if (!firebaseUser?.email) {
      setPasswordError("User not authenticated");
      return;
    }

    try {
      // Reauthenticate user
      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        currentPassword,
      );
      await reauthenticateWithCredential(firebaseUser, credential);

      // Update password
      await updatePassword(firebaseUser, newPassword);

      // Success
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setIsEditingPassword(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (error) {
      console.error("Error updating password:", error);
      if (
        error instanceof Error &&
        error.message.includes("auth/wrong-password")
      ) {
        setPasswordError("Current password is incorrect");
      } else if (
        error instanceof Error &&
        error.message.includes("auth/requires-recent-login")
      ) {
        setPasswordError(
          "Please log out and log back in before changing password",
        );
      } else {
        setPasswordError("Failed to update password. Please try again.");
      }
    }
  };

  return (
    <ProtectedRoute>
      <WikiPage width="article" className="space-y-6 pb-12">
        <WikiHeader
          eyebrow="Your account"
          title="Settings"
          description="Manage how you appear in Oscana and keep your account up to date."
        />

        <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
          <PlayerAvatar
            username={user?.username ?? ""}
            photoUrl={user?.photoUrl}
            className="size-16 sm:size-20"
          />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl font-bold">{user?.username}</p>
            <p className="text-sm text-muted-foreground">
              {[user?.pronouns, user?.role ?? "Citizen"]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            Profile & account
          </span>
        </div>

        {/* Profile Information Card */}
        <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
          <CardHeader className="border-b bg-muted/20 px-5 py-5 sm:px-6">
            <CardTitle className="font-serif text-2xl">
              Profile information
            </CardTitle>
            <CardDescription>
              Choose how other players see and understand your profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-6">
            {!isEditingProfile ? (
              <div className="space-y-5">
                <div className="grid gap-4 rounded-xl border bg-muted/10 p-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Username
                    </Label>
                    <p className="mt-1 text-base font-semibold">
                      {user?.username}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Pronouns
                    </Label>
                    <p className="mt-1 text-base">
                      {user?.pronouns || (
                        <span className="text-muted-foreground">
                          Not specified
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border p-4">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Bio
                  </Label>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                    {user?.bio || "No bio provided"}
                  </p>
                </div>
                <div className="rounded-xl border p-4">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Political leaning
                  </Label>
                  <p className="mt-1 text-sm">
                    {user?.politicalLeaning || "Not specified"}
                  </p>
                </div>
                <Button
                  className="rounded-xl"
                  onClick={() => setIsEditingProfile(true)}
                >
                  Edit profile
                </Button>
              </div>
            ) : (
              <form
                className="space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  profileForm.handleSubmit();
                }}
              >
                {/* Username */}
                <profileForm.Field
                  name="username"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value || value.trim().length === 0) {
                        return "Username is required";
                      }
                      return undefined;
                    },
                  }}
                >
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>
                        Username<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Enter username"
                      />
                      {field.state.meta.errors.length > 0 && (
                        <span className="text-sm text-red-500">
                          {field.state.meta.errors.join(", ")}
                        </span>
                      )}
                    </div>
                  )}
                </profileForm.Field>

                <profileForm.Field
                  name="pronouns"
                  validators={{
                    onChange: ({ value }) =>
                      value.length > 80
                        ? "Pronouns must be 80 characters or fewer"
                        : undefined,
                  }}
                >
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Pronouns (optional)</Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        maxLength={80}
                        placeholder="they/she"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use any wording and order that feels right to you.
                      </p>
                      {field.state.meta.errors.length > 0 && (
                        <span className="text-sm text-red-500">
                          {field.state.meta.errors.join(", ")}
                        </span>
                      )}
                    </div>
                  )}
                </profileForm.Field>

                {/* Bio */}
                <profileForm.Field
                  name="bio"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value || value.trim().length === 0) {
                        return "Bio is required";
                      }
                      return undefined;
                    },
                  }}
                >
                  {(field) => (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor={field.name}>
                          Bio<span className="text-red-500">*</span>
                        </Label>
                        <ReferenceInsert
                          textareaId={field.name}
                          value={field.state.value}
                          onChange={field.handleChange}
                        />
                      </div>
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Tell us about yourself"
                        rows={4}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <span className="text-sm text-red-500">
                          {field.state.meta.errors.join(", ")}
                        </span>
                      )}
                    </div>
                  )}
                </profileForm.Field>

                {/* Political Leaning */}
                <div className="space-y-2">
                  <Label>Political Leaning</Label>
                  <div className="space-y-4">
                    <Slider
                      min={0}
                      max={6}
                      step={1}
                      value={leaning}
                      onValueChange={setLeaning}
                    />
                    <p className="text-center font-medium text-lg">
                      {leanings[leaning[0]]}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="submit">Save Changes</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditingProfile(false);
                      profileForm.reset();
                      setLeaning([
                        initialLeaningIndex >= 0 ? initialLeaningIndex : 3,
                      ]);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {user && (
          <AvatarEditor
            key={user.id}
            initialConfig={user.avatarConfig}
            username={user.username}
          />
        )}

        {/* Password Card */}
        <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
          <CardHeader className="border-b bg-muted/20 px-5 py-5 sm:px-6">
            <CardTitle className="font-serif text-2xl">Password</CardTitle>
            <CardDescription>Update your sign-in credentials.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-6">
            {!isEditingPassword ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Password
                  </Label>
                  <p className="text-lg font-mono">••••••••</p>
                </div>
                <Button onClick={() => setIsEditingPassword(true)}>
                  Edit Password
                </Button>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handlePasswordUpdate}>
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">
                    Current Password<span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">
                    New Password<span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">
                    Confirm New Password<span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                  />
                </div>

                {passwordError && (
                  <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-md text-sm">
                    {passwordError}
                  </div>
                )}

                {passwordSuccess && (
                  <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md text-sm">
                    Password updated successfully!
                  </div>
                )}

                <div className="flex gap-3">
                  <Button type="submit">Update Password</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditingPassword(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordError(null);
                      setPasswordSuccess(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <InvitationManager />
      </WikiPage>
    </ProtectedRoute>
  );
}
