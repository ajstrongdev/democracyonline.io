import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  checkIsAdmin,
  listAccessTokens,
  listDatabaseUsers,
  listFirebaseUsers,
} from "@/lib/server/admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserList from "@/components/admin/user-list";
import DBUserList from "@/components/admin/db-user-list";
import AccessTokenManager from "@/components/admin/access-token-manager";
import GenericSkeleton from "@/components/generic-skeleton";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin")({
  component: RouteComponent,
});

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

interface DatabaseUser {
  id: number;
  email: string;
  username: string;
  role: string | null;
  partyId: number | null;
  createdAt: Date | null;
}

interface AccessToken {
  id: number;
  token: string;
  createdAt: Date | null;
}

function RouteComponent() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [firebaseUsers, setFirebaseUsers] = useState<Array<FirebaseUser>>([]);
  const [dbUsers, setDbUsers] = useState<Array<DatabaseUser>>([]);
  const [tokens, setTokens] = useState<Array<AccessToken>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate({ to: "/" });
      return;
    }

    const loadData = async () => {
      try {
        console.log("[Admin] User email:", user?.email);
        console.log("[Admin] Calling checkIsAdmin...");
        const adminCheck = await checkIsAdmin();
        console.log("[Admin] checkIsAdmin result:", adminCheck);
        setIsAdmin(adminCheck);

        if (!adminCheck) {
          console.log("[Admin] Not admin, redirecting...");
          navigate({ to: "/" });
          return;
        }

        const [fbUsers, databaseUsers, accessTokens] = await Promise.all([
          listFirebaseUsers(),
          listDatabaseUsers(),
          listAccessTokens(),
        ]);

        setFirebaseUsers(fbUsers.users);
        setDbUsers(databaseUsers.users);
        setTokens(accessTokens.tokens);
      } catch {
        navigate({ to: "/" });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, authLoading, navigate]);

  if (authLoading || loading || isAdmin === null) {
    return <GenericSkeleton />;
  }

  const refreshFirebaseUsers = async () => {
    const result = await listFirebaseUsers();
    setFirebaseUsers(result.users);
  };

  const refreshDbUsers = async () => {
    const result = await listDatabaseUsers();
    setDbUsers(result.users);
  };

  const refreshTokens = async () => {
    const result = await listAccessTokens();
    setTokens(result.tokens);
  };

  return (
    <div className="container mx-auto p-4 sm:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage users and access tokens
        </p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="users">
            Users ({firebaseUsers.length})
          </TabsTrigger>
          <TabsTrigger value="tokens">Tokens ({tokens.length})</TabsTrigger>
          <TabsTrigger value="dbusers">DB Users ({dbUsers.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6">
          <UserList
            initialUsers={firebaseUsers}
            onRefresh={refreshFirebaseUsers}
          />
        </TabsContent>
        <TabsContent value="tokens" className="mt-6">
          <AccessTokenManager
            initialTokens={tokens}
            onRefresh={refreshTokens}
          />
        </TabsContent>
        <TabsContent value="dbusers" className="mt-6">
          <DBUserList initialUsers={dbUsers} onRefresh={refreshDbUsers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
