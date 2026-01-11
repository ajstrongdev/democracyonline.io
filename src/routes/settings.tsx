import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { fetchUserInfoByEmail, updateUserProfile } from "@/lib/server/users";
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

export const Route = createFileRoute("/settings")({
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async ({ context }) => {
    if (!context.auth.user?.email) {
      throw redirect({ to: "/login" });
    }

    const userData = await fetchUserInfoByEmail({
      data: { email: context.auth.user.email },
    });
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
  const { user } = Route.useLoaderData();
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
    user.politicalLeaning || "Center",
  );
  const [leaning, setLeaning] = useState([
    initialLeaningIndex >= 0 ? initialLeaningIndex : 3,
  ]);

  const profileForm = useForm({
    defaultValues: {
      username: user.username,
      bio: user.bio || "",
    },
    onSubmit: async ({ value }) => {
      try {
        await updateUserProfile({
          data: {
            userId: user.id,
            username: value.username,
            bio: value.bio,
            politicalLeaning: leanings[leaning[0]],
          },
        });
        setIsEditingProfile(false);
        // Navigate to profile to see updated data
        navigate({ to: "/profile/$id", params: { id: String(user.id) } });
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
    <div className="container mx-auto p-8 max-w-3xl space-y-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">User Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile and account settings
        </p>
      </div>

      {/* Profile Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your username, bio, and political leaning
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isEditingProfile ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Username
                </Label>
                <p className="text-lg">{user.username}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Bio
                </Label>
                <p className="text-base whitespace-pre-wrap">
                  {user.bio || "No bio provided"}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Political Leaning
                </Label>
                <p className="text-lg">
                  {user.politicalLeaning || "Not specified"}
                </p>
              </div>
              <Button onClick={() => setIsEditingProfile(true)}>
                Edit Profile
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
                    <Label htmlFor={field.name}>
                      Bio<span className="text-red-500">*</span>
                    </Label>
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

      {/* Password Card */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>
        <CardContent>
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
    </div>
  );
}
