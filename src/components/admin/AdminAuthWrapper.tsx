"use client";

import { useEffect } from "react";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import GenericSkeleton from "@/components/common/genericskeleton";

const ALLOWED_ADMIN_EMAILS = [
  "jenewland1999@gmail.com",
  "ajstrongdev@pm.me",
  "robertjenner5@outlook.com",
  "spam@hpsaucii.dev",
];

interface AdminAuthWrapperProps {
  children: React.ReactNode;
}

export default function AdminAuthWrapper({ children }: AdminAuthWrapperProps) {
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>Please sign in to access this page.</p>
        </div>
      </div>
    );
  }

  if (!user.email || !ALLOWED_ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
