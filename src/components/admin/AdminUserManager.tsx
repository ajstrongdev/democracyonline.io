"use client";

import { useEffect, useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { trpc } from "@/lib/trpc";
import UserList from "./UserList";
import PartyList from "./PartyList";
import DBUserList from "./DBUserList";
import AccessTokenManager from "./AccessTokenManager";
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
  const [user, loadingAuth] = useAuthState(auth);

  // Load users via tRPC hook
  const {
    data: users = [],
    isLoading: loadingUsers,
    refetch: refetchUsers,
    error: usersError,
  } = trpc.admin.listUsers.useQuery(undefined, {
    enabled: !!user && !loadingAuth,
  });

  // Load parties via tRPC hook
  const {
    data: parties = [],
    isLoading: loadingParties,
    refetch: refetchParties,
    error: partiesError,
  } = trpc.admin.listParties.useQuery(undefined, {
    enabled: !!user && !loadingAuth,
  });

  const isLoading = loadingAuth || loadingUsers || loadingParties;
  const error =
    (usersError && "Failed to load users") ||
    (partiesError && "Failed to load parties") ||
    null;

  if (isLoading) {
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
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="parties">Parties ({parties.length})</TabsTrigger>
          <TabsTrigger value="tokens">Access Tokens</TabsTrigger>
          <TabsTrigger value="dbusers">Purge from DB</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6">
          <UserList initialUsers={users} onRefresh={refetchUsers} />
        </TabsContent>
        <TabsContent value="parties" className="mt-6">
          <PartyList/>
        </TabsContent>
        <TabsContent value="tokens" className="mt-6">
          <AccessTokenManager />
        </TabsContent>
        <TabsContent value="dbusers" className="mt-6">
          <DBUserList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
