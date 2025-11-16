import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import GenericSkeleton from "@/components/genericskeleton";
import { auth } from "./firebase";

export default function withAuth<T extends object>(
  WrappedComponent: React.ComponentType<T>,
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
