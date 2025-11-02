import React, { useEffect } from "react";
import { auth } from "./firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import GenericSkeleton from "@/components/genericskeleton";

export default function withAuth<T extends object>(
  WrappedComponent: React.ComponentType<T>
) {
  function ProtectedRoute(props: T) {
    const [user, loading] = useAuthState(auth);
    const router = useRouter();

    useEffect(() => {
      if (!loading && !user) {
        router.push("/sign-in");
      }
    }, [user, loading, router]);

    if (loading) {
      return <GenericSkeleton />;
    }

    if (!user) {
      return null;
    }

    return <WrappedComponent {...props} />;
  }

  return ProtectedRoute;
}
