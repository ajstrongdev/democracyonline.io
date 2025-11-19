"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import axios from "axios";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { RefreshCw, Search } from "lucide-react";

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
  username?: string;
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
  const [searchQuery, setSearchQuery] = useState("");

  // Update users when initialUsers changes
  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;

    const query = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(query) ||
        u.displayName?.toLowerCase().includes(query) ||
        u.username?.toLowerCase().includes(query) ||
        u.uid.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

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
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">User Management</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by email, username, name, or UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh user list"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          Found {filteredUsers.length} user
          {filteredUsers.length !== 1 ? "s" : ""}
        </p>
      )}

      <div className="grid gap-3">
        {filteredUsers.map((u) => {
          const isAdmin = !!(u.email && ALLOWED_ADMIN_EMAILS.includes(u.email));

          return (
            <Card key={u.uid} className="hover:bg-accent/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base leading-tight">
                      {u.username || u.displayName || u.email || "Unknown User"}
                    </CardTitle>
                    <CardDescription className="mt-1 space-y-0.5">
                      {u.email && (
                        <span className="block text-xs truncate">
                          {u.email}
                        </span>
                      )}
                      <span className="block text-xs text-muted-foreground truncate">
                        {u.uid}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 justify-end">
                    {isAdmin && (
                      <span className="px-2 py-0.5 text-xs font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-200 rounded whitespace-nowrap">
                        Admin
                      </span>
                    )}
                    {u.disabled && (
                      <span className="px-2 py-0.5 text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-200 rounded whitespace-nowrap">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground space-x-3">
                    {u.creationTime && (
                      <span>
                        Created: {new Date(u.creationTime).toLocaleDateString()}
                      </span>
                    )}
                    {u.lastSignInTime && (
                      <span>
                        Last login:{" "}
                        {new Date(u.lastSignInTime).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <Button
                    variant={u.disabled ? "default" : "destructive"}
                    size="sm"
                    onClick={() =>
                      handleToggleUserStatus(u.uid, u.disabled, u.email)
                    }
                    disabled={loading === u.uid || isAdmin}
                    className="w-full sm:w-auto"
                  >
                    {isAdmin
                      ? "Protected"
                      : loading === u.uid
                      ? "..."
                      : u.disabled
                      ? "Enable"
                      : "Disable"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery
                ? "No users found matching your search."
                : "No users to display."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
