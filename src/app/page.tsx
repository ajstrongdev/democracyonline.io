"use client";
import { auth } from "@/lib/firebase";
import { useSignInWithEmailAndPassword, useAuthState } from "react-firebase-hooks/auth";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
} from "@/components/ui/card";
import {
    Button,
    buttonVariants,
} from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, directToProfile } from "@/lib/utils";

export default function Home() {
    const [signInWithEmailAndPassword] = useSignInWithEmailAndPassword(auth);
    const [user, userLoading] = useAuthState(auth);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    useEffect(() => {
        if (user && !userLoading) {
            directToProfile(user.email!, router);
        }
    }, [user, userLoading, router]);

    const signIn = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        
        try {
            const res = await signInWithEmailAndPassword(email, password);
            if (res?.user) {
                console.log("User signed in:", res.user);
                directToProfile(email!, router);
            }
        } catch (err) {
            console.error("Error signing in:", err);
            setError("Failed to sign in. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    if (userLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
                <p>Loading...</p>
            </div>
        );
    }

    if (user) {
        return null; // Will redirect in useEffect
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
            <Card className="w-full max-w-md">
                <CardContent className="grid gap-4">
                    <div className="flex flex-col space-y-2 text-center">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Sign in to your account
                        </h1>
                        <CardDescription>
                            Enter your email and password to sign in.
                        </CardDescription>
                    </div>
                    <form onSubmit={signIn} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Signing In..." : "Sign In"}
                        </Button>
                        {error && (
                            <p className="text-sm text-destructive text-center">
                                {error}
                            </p>
                        )}
                    </form>
                    <CardFooter className="pt-0 flex justify-center">
                        <p className="text-center text-sm text-muted-foreground">
                            Don't have an account?{" "}
                            <Link
                                href="/register"
                                className={cn(
                                    buttonVariants({ variant: "link" }),
                                    "p-0 h-auto align-baseline"
                                )}
                            >
                                Sign up
                            </Link>
                        </p>
                    </CardFooter>
                </CardContent>
            </Card>
        </div>
    );
}
