"use client";
import { auth } from "@/lib/firebase";
import { useSignOut, useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import withAuth from "@/lib/withAuth";
import { useEffect, useState } from "react";
import { usePathname } from 'next/navigation'
import axios from "axios";

interface Party {
    bio: string;
    created_at: string;
    id: Number;
    leader: string;
    manifesto_url: string;
    party_color: string;
    party_name: string;
}

interface UserDetails {
    created_at: string;
    id: Number;
    party?: Party;
    role: string;
    username: string;    
}

function Home() {
    const pathname = usePathname();
    const pathParts = pathname.split("/").filter(Boolean);
    const currentPath = pathParts.length > 2 ? pathParts[2] : "";

    const [user, loading] = useAuthState(auth);
    const [signOut] = useSignOut(auth);
    const router = useRouter();
    const endpoint = process.env.NEXT_PUBLIC_API_URL;
    const [userDetails, updateUserDetails] = useState<UserDetails>();

    const handleSignOut = async () => {
        const success = await signOut();
        if (success) {
            router.push("/");
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
                <p>Loading...</p>
            </div>
        );
    }

    if (!user) {
        return null; // Will redirect in useEffect
    }

    useEffect(() => {
    const fetchUserDetails = async () => {
        const id = pathParts[1];
        if (!id) return;

        const detailsResponse = await axios.get(`${endpoint}/users/${id}`)

        console.log(detailsResponse.data);
        if (detailsResponse.data) {
            updateUserDetails(detailsResponse.data as UserDetails);
        }
    };

    fetchUserDetails();
    }, [pathParts[1], endpoint]);

    return (
        <div>
            <Card>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <CardTitle className="text-2xl">Profile Details</CardTitle>
                        <div className="mt-4 space-y-2">
                            <p>
                                <span className="font-medium">Username:</span> {userDetails?.username}
                            </p>
                            <p>
                                <span className="font-medium">Role:</span> {userDetails?.role}
                            </p>
                            <p>
                                <span className="font-medium">Member Since:</span>{" "}
                                {new Date(userDetails?.created_at || "").toLocaleDateString()}
                            </p>
                            {userDetails?.party && (
                                <>
                                    <h2 className="mt-4 text-xl font-semibold">Party Details</h2>
                                    <p>
                                        <span className="font-medium">Party Name:</span> {userDetails.party.party_name}
                                    </p>
                                    <p>
                                        <span className="font-medium">Bio:</span> {userDetails.party.bio}
                                    </p>
                                    <p>
                                        <span className="font-medium">Leader:</span> {userDetails.party.leader}
                                    </p>
                                    <p>
                                        <span className="font-medium"><a href={userDetails.party.manifesto_url} target="_blank">Manifesto</a></span>
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default withAuth(Home);