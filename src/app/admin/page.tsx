"use client";

import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import GenericSkeleton from "@/components/genericskeleton";

const ALLOWED_ADMIN_EMAILS = [
  "jenewland1999@gmail.com",
  "ajstrongdev@pm.me",
  "robertjenner5@outlook.com",
  "spam@hpsaucii.dev",
];

export default function Page() {
  const [user, loading] = useAuthState(auth);

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

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Page</h1>
      <p className="text-muted-foreground mb-4">
        Welcome, {user.email}! You have admin access.
      </p>
      {/* Add your admin content here */}
    </div>
  );
}
