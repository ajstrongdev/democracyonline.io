"use client";
import { useRouter } from "next/dist/client/components/navigation";
import { useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import GenericSkeleton from "@/components/genericskeleton";
import { auth } from "@/lib/firebase";
import { trpc } from "@/lib/trpc";
import withAuth from "@/lib/withAuth";

function ProfileRedirect() {
  const [user] = useAuthState(auth);
  const router = useRouter();

  const { data: thisUser, isLoading } = trpc.user.getByEmail.useQuery(
    { email: user?.email || "" },
    { enabled: !!user?.email },
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
