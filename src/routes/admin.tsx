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
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Clock, FileText, Gamepad2 } from "lucide-react";
import { toast } from "sonner";

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
  const [advanceLoading, setAdvanceLoading] = useState<{
    game: boolean;
    bills: boolean;
    hourly: boolean;
  }>({ game: false, bills: false, hourly: false });

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

  const runGameAdvance = async () => {
    setAdvanceLoading({ ...advanceLoading, game: true });
    try {
      const response = await fetch("/api/game-advance");
      const data = await response.json();
      if (data.success) {
        toast.success("Game advance completed successfully");
      } else {
        toast.error(`Game advance failed: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      toast.error(`Error running game advance: ${error}`);
    } finally {
      setAdvanceLoading({ ...advanceLoading, game: false });
    }
  };

  const runBillAdvance = async () => {
    setAdvanceLoading({ ...advanceLoading, bills: true });
    try {
      const response = await fetch("/api/bill-advance");
      const data = await response.json();
      if (data.success) {
        toast.success("Bill advance completed successfully");
      } else {
        toast.error(`Bill advance failed: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      toast.error(`Error running bill advance: ${error}`);
    } finally {
      setAdvanceLoading({ ...advanceLoading, bills: false });
    }
  };

  const runHourlyAdvance = async () => {
    setAdvanceLoading({ ...advanceLoading, hourly: true });
    try {
      const response = await fetch("/api/hourly-advance");
      const data = await response.json();
      if (data.success) {
        toast.success(data.message || "Hourly advance completed successfully");
      } else {
        toast.error(`Hourly advance failed: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      toast.error(`Error running hourly advance: ${error}`);
    } finally {
      setAdvanceLoading({ ...advanceLoading, hourly: false });
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage users and access tokens
        </p>
      </div>

      <div className="mb-6 p-4 border rounded-lg bg-card">
        <h2 className="text-xl font-semibold mb-4">Manual Advance Triggers</h2>
        <div className="flex flex-wrap gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={advanceLoading.game}
                className="flex items-center gap-2"
              >
                <Gamepad2 className="w-4 h-4" />
                {advanceLoading.game ? "Running..." : "Run Game Advance"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Run Game Advance?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will advance the game state (elections, party fees,
                  inactive users). Are you sure you want to continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={runGameAdvance}>
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={advanceLoading.bills}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                {advanceLoading.bills ? "Running..." : "Run Bill Advance"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Run Bill Advance?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will advance bills through voting stages. Are you sure
                  you want to continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={runBillAdvance}>
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={advanceLoading.hourly}
                className="flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                {advanceLoading.hourly ? "Running..." : "Run Hourly Advance"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Run Hourly Advance?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will advance stock prices, pay dividends, update
                  campaigns, and record snapshots. Are you sure you want to
                  continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={runHourlyAdvance}>
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
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
