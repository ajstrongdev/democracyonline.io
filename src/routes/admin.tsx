import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  checkIsAdmin,
  listFirebaseUsers,
  listDatabaseUsers,
  listAccessTokens,
} from "@/lib/server/admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserList from "@/components/admin/user-list";
import DBUserList from "@/components/admin/db-user-list";
import AccessTokenManager from "@/components/admin/access-token-manager";
import GenericSkeleton from "@/components/generic-skeleton";

export const Route = createFileRoute("/admin")({
  loader: async () => {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) {
      throw redirect({ to: "/" });
    }

    const [firebaseUsers, dbUsers, tokens] = await Promise.all([
      listFirebaseUsers(),
      listDatabaseUsers(),
      listAccessTokens(),
    ]);

    return {
      firebaseUsers: firebaseUsers.users,
      dbUsers: dbUsers.users,
      tokens: tokens.tokens,
    };
  },
  pendingComponent: () => <GenericSkeleton />,
  component: RouteComponent,
});

function RouteComponent() {
  const { firebaseUsers, dbUsers, tokens } = Route.useLoaderData();

  const refreshFirebaseUsers = async () => {
    redirect({ to: "/admin" });
  };

  const refreshDbUsers = async () => {
    redirect({ to: "/admin" });
  };

  const refreshTokens = async () => {
    redirect({ to: "/admin" });
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
