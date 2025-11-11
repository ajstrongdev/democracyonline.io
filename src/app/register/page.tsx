/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";
import { auth } from "@/lib/firebase";
import { useCreateUserWithEmailAndPassword } from "react-firebase-hooks/auth";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import axios from "axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Slider } from "@/components/ui/slider";
import { leanings } from "../parties/create/page";
import { LaunchCountdown } from "@/components/LaunchCountdown";
import { Info, AlertTriangle } from "lucide-react";

export default function Home() {
  const [createUserWithEmailAndPassword] =
    useCreateUserWithEmailAndPassword(auth);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [leaning, setLeaning] = React.useState([3]);
  const [bio, setBio] = useState("");
  const [launchTime] = useState(new Date("2025-11-02T20:00:00Z"));
  const [isLaunched, setIsLaunched] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsLaunched(new Date() >= launchTime);
  }, [launchTime]);

  const signUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    try {
      // Validate access token first
      const tokenValidation = await axios.post("/api/access-token/validate", {
        token: accessToken,
      });

      if (!tokenValidation.data.valid) {
        setError(tokenValidation.data.error || "Invalid access token");
        return;
      }

      // Create Firebase user
      const res = await createUserWithEmailAndPassword(email, password);
      if (res?.user) {
        console.log("User created:", res.user);
        const leaningItem = leanings[leaning[0]];
        await insertUserToDatabase(email, username, bio, leaningItem);

        // Consume the access token after successful signup
        await axios.post("/api/access-token/consume", {
          token: accessToken,
        });

        router.push("/profile");
      }
    } catch (err: any) {
      console.error("Error creating user:", err);
      setError(err.response?.data?.error || "An error occurred during signup");
    }
  };

  const insertUserToDatabase = async (
    email: string,
    username: string,
    bio: string,
    leaning: string
  ) => {
    try {
      const response = await axios.post("/api/create-user", {
        email,
        username,
        bio,
        leaning,
      });
      console.log("User inserted into database:", response.data);
      await axios.post("/api/feed-add", {
        userId: response.data.id,
        content: "Just spawned into existence!",
      });
    } catch (error) {
      console.error("Error inserting user into database:", error);
    }
  };

  if (!isLaunched) {
    return (
      <div className="flex flex-col items-center justify-center bg-background px-6 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col space-y-2 text-center">
              <LaunchCountdown />
              <CardDescription>
                Democracyonline.io goes live on November 2nd, at 8:00 PM GMT
              </CardDescription>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-4 md:py-12 bg-background px-4 ">
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="flex flex-col space-y-2 text-center mb-4">
            <h1 className="text-2xl font-semibold tracking-tight">
              Create your politician
            </h1>
            <CardDescription>
              Enter <b>democracyonline.io</b> as a politician and kickstart your
              political career!
            </CardDescription>
          </div>
          <form onSubmit={signUp} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="accessToken">
                Access Token <span className="text-red-500">*</span>
              </Label>
              <Input
                id="accessToken"
                type="text"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                required
                autoFocus
                placeholder="Enter your access token"
              />
            </div>
            {error && (
              <div className="p-3 text-sm border text-red-500 rounded-md">
                <AlertTriangle className="inline-block mr-2" /> {error}
              </div>
            )}
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              <p>
                Join our{" "}
                <a
                  href="https://discord.gg/m7gDfgJund"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary"
                >
                  Discord
                </a>{" "}
                to request an access token.
              </p>
            </div>
            <hr />
            <div className="grid gap-2">
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">
                Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <hr />
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
              <Label className="block text-center mb-4">
                <span className="text-lg font-medium">
                  Your Political Leaning:{" "}
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
            <div className="grid gap-2 mt-2">
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
            <Button type="submit">Sign Up</Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "link" }),
                "p-0 h-auto align-baseline"
              )}
            >
              Log in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
