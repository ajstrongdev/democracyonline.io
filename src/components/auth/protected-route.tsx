import { Navigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import GenericSkeleton from "@/components/generic-skeleton";
import { userActivityMiddleware } from "@/middleware";

const trackUserActivity = createServerFn()
  .middleware([userActivityMiddleware])
  .handler(() => {
    return { success: true };
  });

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) {
      trackUserActivity().catch((error) => {
        console.error("Failed to track user activity:", error);
      });
    }
  }, [user]);

  if (loading) {
    return <GenericSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
