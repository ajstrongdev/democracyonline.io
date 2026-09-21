import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock3, FileText, Gamepad2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  checkIsAdmin,
  forceNextElectionStage,
  listDatabaseUsers,
  listFirebaseUsers,
  setElectionStageDeadline,
} from "@/lib/server/admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserList from "@/components/admin/user-list";
import DBUserList from "@/components/admin/db-user-list";
import GenericSkeleton from "@/components/generic-skeleton";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  moderationRole: string;
  partyId: number | null;
  createdAt: Date | null;
}

function RouteComponent() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [firebaseUsers, setFirebaseUsers] = useState<Array<FirebaseUser>>([]);
  const [dbUsers, setDbUsers] = useState<Array<DatabaseUser>>([]);
  const [loading, setLoading] = useState(true);
  const [advanceLoading, setAdvanceLoading] = useState<{
    game: boolean;
    bills: boolean;
    elections: boolean;
  }>({ game: false, bills: false, elections: false });
  const [gameAdvanceCount, setGameAdvanceCount] = useState(1);
  const [billAdvanceCount, setBillAdvanceCount] = useState(1);

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

        const [fbUsers, databaseUsers] = await Promise.all([
          listFirebaseUsers(),
          listDatabaseUsers(),
        ]);

        setFirebaseUsers(fbUsers.users);
        setDbUsers(databaseUsers.users);
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

  const getManualAdvanceHeaders = async () => {
    if (!user) {
      throw new Error("Not authenticated");
    }

    const idToken = await user.getIdToken();
    return {
      authorization: `Bearer ${idToken}`,
      "x-admin-cron-trigger": "1",
    };
  };

  const runGameAdvance = async () => {
    setAdvanceLoading({ ...advanceLoading, game: true });
    try {
      const headers = await getManualAdvanceHeaders();
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < gameAdvanceCount; i++) {
        const response = await fetch("/api/game-advance", { headers });
        const data = await response.json();
        if (data.success) {
          successCount++;
        } else {
          failCount++;
          toast.error(
            `Game advance ${i + 1} failed: ${data.error || "Unknown error"}`,
          );
        }
      }

      if (successCount > 0) {
        toast.success(
          `Game advance completed ${successCount} time(s) successfully`,
        );
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
      const headers = await getManualAdvanceHeaders();
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < billAdvanceCount; i++) {
        const response = await fetch("/api/bill-advance", { headers });
        const data = await response.json();
        if (data.success) {
          successCount++;
        } else {
          failCount++;
          toast.error(
            `Bill advance ${i + 1} failed: ${data.error || "Unknown error"}`,
          );
        }
      }

      if (successCount > 0) {
        toast.success(
          `Bill advance completed ${successCount} time(s) successfully`,
        );
      }
    } catch (error) {
      toast.error(`Error running bill advance: ${error}`);
    } finally {
      setAdvanceLoading({ ...advanceLoading, bills: false });
    }
  };

  const processElectionDeadlines = async () => {
    setAdvanceLoading((current) => ({ ...current, elections: true }));
    try {
      const headers = await getManualAdvanceHeaders();
      const response = await fetch("/api/election-advance", {
        method: "POST",
        headers,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Election heartbeat failed");
      }
      toast.success("Due election deadlines processed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Election heartbeat failed",
      );
    } finally {
      setAdvanceLoading((current) => ({ ...current, elections: false }));
    }
  };

  const forceNextStage = async (election: "President" | "Senate") => {
    setAdvanceLoading((current) => ({ ...current, elections: true }));
    try {
      await forceNextElectionStage({ data: { election } });
      toast.success(`${election} election advanced to its next stage`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Advance failed");
    } finally {
      setAdvanceLoading((current) => ({ ...current, elections: false }));
    }
  };

  const scheduleNextStage = async (election: "President" | "Senate") => {
    setAdvanceLoading((current) => ({ ...current, elections: true }));
    try {
      await setElectionStageDeadline({ data: { election, seconds: 10 } });
      toast.success(`${election} stage will end in 10 seconds`);
      window.setTimeout(() => void processElectionDeadlines(), 10_500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Override failed");
    } finally {
      setAdvanceLoading((current) => ({ ...current, elections: false }));
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage users, game operations, and moderation
        </p>
      </div>

      <Button
        variant="outline"
        className="mb-6"
        onClick={() => navigate({ to: "/moderation" })}
      >
        <ShieldCheck className="h-4 w-4" /> Open moderation queue
      </Button>

      <div className="mb-6 p-4 border rounded-lg bg-card">
        <h2 className="text-xl font-semibold mb-4">Manual Advance Triggers</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-3">
            <Label>Election heartbeat</Label>
            <p className="min-h-10 text-sm text-muted-foreground">
              Process timestamp deadlines now. This does not skip time or force
              a phase change.
            </p>
            <Button
              variant="outline"
              disabled={advanceLoading.elections}
              className="w-full flex items-center gap-2"
              onClick={processElectionDeadlines}
            >
              <Clock3 className="w-4 h-4" />
              {advanceLoading.elections
                ? "Processing..."
                : "Process due stages"}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={advanceLoading.elections}
                onClick={() => scheduleNextStage("President")}
              >
                President in 10s
              </Button>
              <Button
                variant="outline"
                disabled={advanceLoading.elections}
                onClick={() => scheduleNextStage("Senate")}
              >
                Senate in 10s
              </Button>
              <Button
                variant="destructive"
                disabled={advanceLoading.elections}
                onClick={() => forceNextStage("President")}
              >
                Next President stage
              </Button>
              <Button
                variant="destructive"
                disabled={advanceLoading.elections}
                onClick={() => forceNextStage("Senate")}
              >
                Next Senate stage
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="game-count">Game Advance</Label>
            <Input
              id="game-count"
              type="number"
              min={1}
              max={100}
              value={gameAdvanceCount}
              onChange={(e) =>
                setGameAdvanceCount(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-full"
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={advanceLoading.game}
                  className="w-full flex items-center gap-2"
                >
                  <Gamepad2 className="w-4 h-4" />
                  {advanceLoading.game
                    ? "Running..."
                    : `Run ${gameAdvanceCount}x`}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Run Game Advance {gameAdvanceCount} time(s)?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This runs daily user activity and party maintenance{" "}
                    {gameAdvanceCount} time(s). Election stages only change when
                    their timestamp deadline is due. Continue?
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
          </div>

          <div className="space-y-3">
            <Label htmlFor="bill-count">Bill Advance</Label>
            <Input
              id="bill-count"
              type="number"
              min={1}
              max={100}
              value={billAdvanceCount}
              onChange={(e) =>
                setBillAdvanceCount(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-full"
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={advanceLoading.bills}
                  className="w-full flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {advanceLoading.bills
                    ? "Running..."
                    : `Run ${billAdvanceCount}x`}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Run Bill Advance {billAdvanceCount} time(s)?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will advance bills through voting stages{" "}
                    {billAdvanceCount} time(s). Are you sure you want to
                    continue?
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
          </div>
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-2">
          <TabsTrigger value="users">
            Users ({firebaseUsers.length})
          </TabsTrigger>
          <TabsTrigger value="dbusers">DB Users ({dbUsers.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6">
          <UserList
            initialUsers={firebaseUsers}
            onRefresh={refreshFirebaseUsers}
          />
        </TabsContent>
        <TabsContent value="dbusers" className="mt-6">
          <DBUserList initialUsers={dbUsers} onRefresh={refreshDbUsers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
