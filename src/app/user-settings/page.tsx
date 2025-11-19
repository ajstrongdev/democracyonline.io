"use client";

import withAuth from "@/lib/withAuth";
import React, { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { fetchUserInfo } from "@/app/utils/userHelper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import axios from "axios";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";

export const leanings = [
  "Far Left",
  "Left",
  "Center Left",
  "Center",
  "Center Right",
  "Right",
  "Far Right",
];

function UserSettings() {
  const [user] = useAuthState(auth);
  const queryClient = useQueryClient();
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [leaning, setLeaning] = useState([3]);

  const { data: thisUser } = useQuery({
    queryKey: ["user", user?.email],
    queryFn: () =>
      fetchUserInfo(user?.email || "").then((data) => data || null),
    enabled: !!user?.email,
  });

  useEffect(() => {
    if (thisUser) {
      setUsername(thisUser.username || "");
      setBio(thisUser.bio || "");

      // Find the index of the political leaning
      const leaningIndex = leanings.findIndex(
        (l) => l === thisUser.political_leaning
      );
      if (leaningIndex !== -1) {
        setLeaning([leaningIndex]);
      }
    }
  }, [thisUser]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: {
      username: string;
      bio: string;
      political_leaning: string;
    }) => {
      const response = await axios.post("/api/user-update", {
        userId: thisUser?.id,
        username: data.username,
        bio: data.bio,
        political_leaning: data.political_leaning,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["user", user?.email] });
      setIsEditingProfile(false);
    },
    onError: () => {
      toast.error("Failed to update profile");
    },
  });

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (!user || !user.email) {
      toast.error("User not authenticated");
      return;
    }

    try {
      // Reauthenticate user
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, newPassword);
      toast.success("Password updated successfully!");
      setIsEditingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Password update error:", error);
      if (error.code === "auth/wrong-password") {
        toast.error("Current password is incorrect");
      } else {
        toast.error("Failed to update password");
      }
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }

    if (!bio.trim()) {
      toast.error("Bio is required");
      return;
    }

    updateProfileMutation.mutate({
      username: username.trim(),
      bio: bio.trim(),
      political_leaning: leanings[leaning[0]],
    });
  };

  if (!thisUser) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          User Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account settings and profile information
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Information Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription className="my-2">
                  Update your public profile details
                </CardDescription>
              </div>
              {!isEditingProfile && (
                <Button
                  variant="outline"
                  onClick={() => setIsEditingProfile(true)}
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingProfile ? (
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="username">
                    Username <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bio">
                    Bio <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    required
                    placeholder="Tell us about yourself..."
                    rows={4}
                    className="resize-none"
                  />
                </div>
                <div>
                  <Label className="block text-center mb-4">
                    <span className="text-lg font-medium">
                      Political Leaning:{" "}
                    </span>
                    <span className="font-sm">{leanings[leaning[0]]}</span>
                  </Label>

                  <div className="w-full">
                    <Slider
                      value={leaning}
                      onValueChange={setLeaning}
                      max={6}
                      step={1}
                      className="cursor-pointer"
                    />

                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      {leanings.map((label, i) => (
                        <span
                          key={i}
                          className="text-center flex-shrink-0"
                          style={{ width: "14.28%" }}
                        >
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
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending
                      ? "Saving..."
                      : "Save Profile"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditingProfile(false);
                      // Reset to original values
                      setUsername(thisUser.username || "");
                      setBio(thisUser.bio || "");
                      const leaningIndex = leanings.findIndex(
                        (l) => l === thisUser.political_leaning
                      );
                      if (leaningIndex !== -1) {
                        setLeaning([leaningIndex]);
                      }
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Username</Label>
                  <p className="mt-1">{thisUser.username}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Bio</Label>
                  <p className="mt-1 whitespace-pre-wrap">{thisUser.bio}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    Political Leaning
                  </Label>
                  <p className="mt-1">{thisUser.political_leaning}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Password Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Password</CardTitle>
                <CardDescription>Update your password</CardDescription>
              </div>
              {!isEditingPassword && (
                <Button
                  variant="outline"
                  onClick={() => setIsEditingPassword(true)}
                >
                  Edit Password
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingPassword ? (
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="current-password">
                    Current Password <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-password">
                    New Password <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">
                    Confirm New Password <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Save Password</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditingPassword(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-muted-foreground">••••••••</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default withAuth(UserSettings);
