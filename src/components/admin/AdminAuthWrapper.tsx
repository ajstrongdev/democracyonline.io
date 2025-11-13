"use client";

import { useEffect } from "react";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import GenericSkeleton from "@/components/genericskeleton";

interface AdminAuthWrapperProps {
  children: React.ReactNode;
}

export default function AdminAuthWrapper({ children }: AdminAuthWrapperProps) {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const {
    data: verify,
    isLoading: verifyLoading,
    error: verifyError,
  } = trpc.admin.verify.useQuery(
    {},
    {
      enabled: !!user && !loading,
      retry: false,
    }
  );

  useEffect(() => {
    if (!loading && !user) {
      router.push("/sign-in");
    }
  }, [user, loading, router]);

  // Still loading
  if (loading || verifyLoading) {
    return <GenericSkeleton />;
  }

  // Not signed in
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>Please sign in to access this page.</p>
        </div>
      </div>
    );
  }

  // Not an admin
  if (verifyError?.data?.code === "FORBIDDEN") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  // Other errors
  if (verifyError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p>An error occurred while verifying admin access.</p>
        </div>
      </div>
    );
  }

  // Admin verified
  return <>{children}</>;
}
