"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ALLOWED_ADMIN_EMAILS = [
  "jenewland1999@gmail.com",
  "ajstrongdev@pm.me",
  "robertjenner5@outlook.com",
  "spam@hpsaucii.dev",
];

interface DatabaseUser {
  id: string;
  email: string;
  username: string;
  role: string;
  party_id: string | null;
  created_at: string;
}

export default function DBUserList() {
  const [user] = useAuthState(auth);
  const [users, setUsers] = useState<DatabaseUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const purgeUserData = async (id: string) => {
    if (!user) {
      alert("You must be logged in to purge users");
      return;
    }

    try {
      // Get the current user's ID token
      const idToken = await user.getIdToken();

      const response = await fetch(`/api/admin/purge?userId=${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to purge user data");
      }

      const result = await response.json();
      alert(`User data purged successfully. ${result.message}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "An error occurred");
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/admin/userlist");

        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }

        const data = await response.json();
        setUsers(data.users || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    if (user && ALLOWED_ADMIN_EMAILS.includes(user.email || "")) {
      fetchUsers();
    }
  }, [user]);

  const handleKick = async (userId: string, username: string) => {
    if (confirm(`Are you sure you want to kick ${username}?`)) {
      await purgeUserData(userId);
      // Refresh the user list after purging
      const response = await fetch("/api/admin/userlist");
      const data = await response.json();
      setUsers(data.users || []);
    }
  };

  if (!user || !ALLOWED_ADMIN_EMAILS.includes(user.email || "")) {
    return (
      <div className="p-6">
        <p className="text-destructive">
          Access denied. Admin privileges required.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <p>Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Database Users</h1>
        <p className="text-muted-foreground">Total users: {users.length}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((dbUser) => (
          <Card key={dbUser.id}>
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
                  {dbUser.party_id || "None"}
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
              >
                Kick User
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {users.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          No users found in the database.
        </div>
      )}
    </div>
  );
}
