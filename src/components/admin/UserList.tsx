"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import axios from "axios";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { RefreshCw } from "lucide-react";

const ALLOWED_ADMIN_EMAILS = [
  "jenewland1999@gmail.com",
  "ajstrongdev@pm.me",
  "robertjenner5@outlook.com",
  "spam@hpsaucii.dev",
];

interface FirebaseUser {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  disabled: boolean;
  emailVerified: boolean;
  creationTime?: string;
  lastSignInTime?: string;
}

interface UserListProps {
  initialUsers: FirebaseUser[];
  onRefresh?: () => void | Promise<void>;
}

export default function UserList({ initialUsers, onRefresh }: UserListProps) {
  const [user] = useAuthState(auth);
  const [users, setUsers] = useState<FirebaseUser[]>(initialUsers);
  const [loading, setLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Update users when initialUsers changes
  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
  };

  const handleToggleUserStatus = async (
    uid: string,
    currentStatus: boolean,
    targetEmail?: string
  ) => {
    if (!user) {
      toast.error("Authentication error");
      return;
    }

    // Prevent disabling admin accounts
    if (targetEmail && ALLOWED_ADMIN_EMAILS.includes(targetEmail)) {
      toast.error("Cannot disable admin accounts");
      return;
    }

    setLoading(uid);
    try {
      // Get the current user's ID token
      const idToken = await user.getIdToken();

      await axios.post(
        "/api/admin/toggle-user-status",
        {
          uid,
          disabled: !currentStatus,
        },
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      // Update local state
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.uid === uid ? { ...u, disabled: !currentStatus } : u
        )
      );

      toast.success(
        `User ${!currentStatus ? "disabled" : "enabled"} successfully`
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        toast.error("Cannot disable admin accounts");
      } else {
        toast.error("Failed to update user status");
      }
      console.error("Error toggling user status:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">User Management</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {users.map((u) => {
          const isAdmin = !!(u.email && ALLOWED_ADMIN_EMAILS.includes(u.email));

          return (
            <Card key={u.uid}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {u.displayName || u.email || "Unknown User"}
                    </CardTitle>
                    <CardDescription>
                      {u.email && <span className="block">{u.email}</span>}
                      <span className="text-xs">UID: {u.uid}</span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <span className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-200 rounded">
                        Admin
                      </span>
                    )}
                    {u.disabled && (
                      <span className="px-2 py-1 text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-200 rounded">
                        Disabled
                      </span>
                    )}
                    {!u.emailVerified && (
                      <span className="px-2 py-1 text-xs font-semibold text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200 rounded">
                        Unverified
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground space-y-1">
                    {u.creationTime && (
                      <p>
                        Created: {new Date(u.creationTime).toLocaleDateString()}
                      </p>
                    )}
                    {u.lastSignInTime && (
                      <p>
                        Last sign in:{" "}
                        {new Date(u.lastSignInTime).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button
                    variant={u.disabled ? "default" : "destructive"}
                    onClick={() =>
                      handleToggleUserStatus(u.uid, u.disabled, u.email)
                    }
                    disabled={loading === u.uid || isAdmin}
                  >
                    {isAdmin
                      ? "Admin Protected"
                      : loading === u.uid
                      ? "Processing..."
                      : u.disabled
                      ? "Enable User"
                      : "Disable User"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
