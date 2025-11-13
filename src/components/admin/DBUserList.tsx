/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface DatabaseUser {
  id: number | string;
  email: string;
  username: string;
  role: string;
  party_id: number | string | null;
  created_at: string;
}

export default function DBUserList() {
  const [searchQuery, setSearchQuery] = useState("");

  // Load users via tRPC hook. Server enforces admin permissions.
  const {
    data: dbUsers = [],
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.admin.listUsers.useQuery();

  // Purge mutation. Server enforces admin permissions.
  const purgeUser = trpc.admin.purgeUser.useMutation({
    onSuccess: async () => {
      toast.success("User data purged successfully.");
      await refetch();
    },
    onError: (err) => {
      if ((err as any)?.data?.code === "FORBIDDEN") {
        toast.error("Access denied. Admin privileges required.");
        return;
      }
      toast.error(err?.message || "Failed to purge user");
    },
  });

  const handleKick = async (userId: number | string, username: string) => {
    if (confirm(`Are you sure you want to purge ${username}?`)) {
      purgeUser.mutate({ userId: Number(userId) });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <p>Loading users...</p>
      </div>
    );
  }

  if (isError) {
    if ((error as any)?.data?.code === "FORBIDDEN") {
      return (
        <div className="p-6">
          <p className="text-destructive">Access denied. Admin privileges required.</p>
        </div>
      );
    }
    return (
      <div className="p-6">
        <p className="text-destructive">Error loading users</p>
      </div>
    );
  }

  const users = dbUsers as DatabaseUser[];

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return (
        (u.username || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        String(u.id).toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  return (
    <div className="p-6 space-y-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Database Users</h1>
        <p className="text-muted-foreground">
          Total users: {users.length}{" "}
          {searchQuery && `(Showing ${filteredUsers.length})`}
        </p>
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search by username, email, ID, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((dbUser) => (
          <Card key={`${dbUser.id}`}>
            <CardHeader>
              <CardTitle>{dbUser.username}</CardTitle>
              <CardDescription>{dbUser.email}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold">ID:</span> {dbUser.id}
                </div>
                <div>
                  <span className="font-semibold">Role:</span> {dbUser.role}
                </div>
                <div>
                  <span className="font-semibold">Party ID:</span>{" "}
                  {dbUser.party_id ?? "None"}
                </div>
                <div>
                  <span className="font-semibold">Created:</span>{" "}
                  {new Date(dbUser.created_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="destructive"
                onClick={() => handleKick(dbUser.id, dbUser.username)}
                className="w-full"
                disabled={purgeUser.isPending}
              >
                {purgeUser.isPending ? "Purging..." : "Purge User"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {filteredUsers.length === 0 && !searchQuery && (
        <div className="text-center text-muted-foreground py-12">
          No users found in the database.
        </div>
      )}

      {filteredUsers.length === 0 && searchQuery && (
        <div className="text-center text-muted-foreground py-12">
          No users match your search query.
        </div>
      )}
    </div>
  );
}
