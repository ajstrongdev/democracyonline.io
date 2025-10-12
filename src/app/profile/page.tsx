"use client";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/dist/client/components/navigation";
import { fetchUserInfo } from "@/app/utils/userHelper";
import withAuth from "@/lib/withAuth";
import GenericSkeleton from "@/components/genericskeleton";

function ProfileRedirect() {
  const [user] = useAuthState(auth);
  const router = useRouter();

  const { data: thisUser, isLoading } = useQuery({
    queryKey: ["fetchUserInfo", user?.email],
    queryFn: async () => {
      return fetchUserInfo(user?.email || "").then((data) => data || null);
    },
    enabled: !!user?.email,
  });

  useEffect(() => {
    if (thisUser?.id) {
      router.push(`/profile/${thisUser.id}`);
    }
  }, [thisUser, router]);

  if (isLoading) {
    return <GenericSkeleton />;
  }
}

export default withAuth(ProfileRedirect);
