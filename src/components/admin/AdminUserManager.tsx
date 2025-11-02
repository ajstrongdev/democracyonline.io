"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import axios from "axios";
import UserList from "./UserList";
import GenericSkeleton from "@/components/genericskeleton";

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

export default function AdminUserManager() {
  const [user, loading] = useAuthState(auth);
  const [users, setUsers] = useState<FirebaseUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!user) {
      setLoadingUsers(false);
      return;
    }

    try {
      setLoadingUsers(true);
      const idToken = await user.getIdToken();

      const response = await axios.post(
        "/api/admin/list-users",
        {},
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      setUsers(response.data.users);
      setError(null);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading) {
      fetchUsers();
    }
  }, [loading, fetchUsers]);

  if (loading || loadingUsers) {
    return <GenericSkeleton />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage Firebase Authentication users
        </p>
      </div>

      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Total users: {users.length}
        </p>
      </div>

      <UserList initialUsers={users} onRefresh={fetchUsers} />
    </div>
  );
}
