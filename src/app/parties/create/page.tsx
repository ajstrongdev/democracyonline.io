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

function Home() {
  const [user] = useAuthState(auth);
  const router = useRouter();

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

  const submitHandler = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!thisUser?.id) return;

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement)?.value;
    const color = (form.elements.namedItem("color") as HTMLInputElement)?.value;
    const bio = (form.elements.namedItem("bio") as HTMLInputElement)?.value;
    const manifestoUrl = (
      form.elements.namedItem("manifesto") as HTMLInputElement
    )?.value;
    try {
      const response = await axios.post("/api/party-create", {
        userId: thisUser.id,
        name,
        color,
        bio,
        manifestoUrl,
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
              Party Name
            </Label>
            <Input type="text" id="name" placeholder="Enter party name" />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Label
              htmlFor="color"
              className="text-lg font-medium text-foreground"
            >
              Party Color
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
              Party Bio
            </Label>
            <Textarea
              id="bio"
              placeholder="Brief description of your party"
              className="min-h-[80px]"
            />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Label
              htmlFor="manifesto"
              className="text-lg font-medium text-foreground"
            >
              Manifesto URL
            </Label>
            <Input
              type="url"
              id="manifesto"
              placeholder="https://example.com/manifesto"
            />
          </div>
          <Button type="submit" className="w-full py-3">
            Create Party
          </Button>
        </form>
      </div>
    </div>
  );
}

export default withAuth(Home);
