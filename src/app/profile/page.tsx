"use client";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import React, { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/dist/client/components/navigation";
import withAuth from "@/lib/withAuth";
import GenericSkeleton from "@/components/genericskeleton";

function ProfileRedirect() {
  const [user] = useAuthState(auth);
  const router = useRouter();

  const {
    data: thisUser,
    isLoading,
  } = trpc.user.getByEmail.useQuery(
    { email: user?.email || "" },
    { enabled: !!user?.email }
  );

  useEffect(() => {
    if (thisUser?.id) {
      router.push(`/profile/${thisUser.id}`);
    }
  }, [thisUser, router]);

  if (isLoading || thisUser) {
    return <GenericSkeleton />;
  }

  return <GenericSkeleton />;
}

export default withAuth(ProfileRedirect);
