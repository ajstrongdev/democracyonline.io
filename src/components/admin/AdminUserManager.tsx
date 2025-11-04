"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import axios from "axios";
import UserList from "./UserList";
import PartyList from "./PartyList";
import DBUserList from "./DBUserList";
import GenericSkeleton from "@/components/genericskeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface Party {
  id: number;
  name: string;
  description: string;
  economic_position: number;
  social_position: number;
  leader_id: number | null;
  leader_username: string | null;
  member_count: number;
  created_at: string;
}

export default function AdminUserManager() {
  const [user, loading] = useAuthState(auth);
  const [users, setUsers] = useState<FirebaseUser[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingParties, setLoadingParties] = useState(true);
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

  const fetchParties = useCallback(async () => {
    if (!user) {
      setLoadingParties(false);
      return;
    }

    try {
      setLoadingParties(true);
      const idToken = await user.getIdToken();

      const response = await axios.post(
        "/api/admin/list-parties",
        {},
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      setParties(response.data.parties);
      setError(null);
    } catch (err) {
      console.error("Error fetching parties:", err);
      setError("Failed to load parties");
    } finally {
      setLoadingParties(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading) {
      fetchUsers();
      fetchParties();
    }
  }, [loading, fetchUsers, fetchParties]);

  if (loading || (loadingUsers && loadingParties)) {
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
    <div className="container mx-auto p-4 sm:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage users and parties
        </p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="parties">Parties ({parties.length})</TabsTrigger>
          <TabsTrigger value="dbusers">Purge from DB</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6">
          <UserList initialUsers={users} onRefresh={fetchUsers} />
        </TabsContent>
        <TabsContent value="parties" className="mt-6">
          <PartyList initialParties={parties} onRefresh={fetchParties} />
        </TabsContent>
        <TabsContent value="dbusers" className="mt-6">
          <DBUserList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
