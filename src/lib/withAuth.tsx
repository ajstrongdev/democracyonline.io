import React, { useEffect, useState } from "react";
import { auth } from "./firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import GenericSkeleton from "@/components/genericskeleton";

export default function withAuth<T extends object>(
  WrappedComponent: React.ComponentType<T>
) {
  function ProtectedRoute(props: T) {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user] = useAuthState(auth);
    const router = useRouter();

    useEffect(() => {
      if (user) {
        setIsAuthenticated(true);
        setIsLoading(false);
      } else if (!user && !isLoading) {
        setIsAuthenticated(false);
        setIsLoading(false);
        router.push("/");
      }
    }, [user, router]);

    if (isLoading) {
      return (
        <GenericSkeleton />
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    return <WrappedComponent {...props} />;
  }

  return ProtectedRoute;
}
