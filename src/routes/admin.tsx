import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock3, FileText, Gamepad2, Gauge, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  checkIsAdmin,
  forceNextElectionStage,
  listDatabaseUsers,
  listFirebaseUsers,
  purgeAllOtherAccounts,
  setElectionStageDeadline,
} from "@/lib/server/admin";
import { getGameSpeedFn, setGameSpeedFn } from "@/lib/server/game-speed";
import { describeGameSpeed } from "@/lib/game-speed";
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
  beforeLoad: () => { throw redirect({ to: "/dashboard/admin" }); },
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

export function AdminContent() {
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
  const [gameSpeed, setGameSpeed] = useState<{
    mode: string;
    multiplier: number;
    pace: ReturnType<typeof describeGameSpeed>;
    modes: Array<{
      mode: string;
      multiplier: number;
      label: string;
      blurb: string;
    }>;
  } | null>(null);
  const [pendingSpeed, setPendingSpeed] = useState<string | null>(null);
  const [speedSaving, setSpeedSaving] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeConfirmation, setPurgeConfirmation] = useState("");
  const [purgeLoading, setPurgeLoading] = useState(false);

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

        const [fbUsers, databaseUsers, speed] = await Promise.all([
          listFirebaseUsers(),
          listDatabaseUsers(),
          getGameSpeedFn(),
        ]);

        setFirebaseUsers(fbUsers.users);
        setDbUsers(databaseUsers.users);
        setGameSpeed(speed);
      } catch {
        navigate({ to: "/" });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, authLoading, navigate]);

  if (authLoading || loading || !isAdmin) {
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

  const applyGameSpeed = async () => {
    if (!pendingSpeed) return;
    setSpeedSaving(true);
    try {
      const result = await setGameSpeedFn({ data: { mode: pendingSpeed } });
      setGameSpeed((current) =>
        current
          ? {
              ...current,
              mode: result.mode,
              multiplier: result.multiplier,
              pace: result.pace,
            }
          : current,
      );
      setPendingSpeed(null);
      const r = result.rescaled;
      toast.success(
        `Game speed set to ${result.mode} (${result.multiplier}x). ` +
          `Rescaled ${r.bills} bill, ${r.candidacy + r.voting + r.electionNight + r.concluded} election, ${r.reveals} reveal deadlines.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not set game speed",
      );
    } finally {
      setSpeedSaving(false);
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

  const purgeOtherAccounts = async () => {
    setPurgeLoading(true);
    try {
      const result = await purgeAllOtherAccounts({
        data: { confirm: purgeConfirmation },
      });
      toast.success(
        `Deleted ${result.databaseDeleted} database users and ${result.firebaseDeleted} Firebase accounts.`,
      );
      setPurgeOpen(false);
      setPurgeConfirmation("");
      const [fbUsers, databaseUsers] = await Promise.all([
        listFirebaseUsers(),
        listDatabaseUsers(),
      ]);
      setFirebaseUsers(fbUsers.users);
      setDbUsers(databaseUsers.users);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete accounts",
      );
    } finally {
      setPurgeLoading(false);
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

        <div className="mt-6 border-t pt-6">
          <div className="mb-1 flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            <h3 className="text-lg font-semibold">Game speed</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            {gameSpeed ? (
              <>
                Running at <strong>{gameSpeed.mode}</strong> (
                {gameSpeed.multiplier}x). Pres cycle {gameSpeed.pace.presCycle},
                senate {gameSpeed.pace.senateCycle}, bill stages{" "}
                {gameSpeed.pace.billStage}, game tick {gameSpeed.pace.gameTick}.
                Switching rescales every live deadline proportionally.
              </>
            ) : (
              "Loading current pace…"
            )}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(gameSpeed?.modes ?? []).map((preset) => {
              const pace = describeGameSpeed(preset.multiplier);
              const active = gameSpeed?.mode === preset.mode;
              return (
                <Button
                  key={preset.mode}
                  variant={active ? "default" : "outline"}
                  disabled={speedSaving || active}
                  className="h-auto flex-col items-start gap-1 px-3 py-2.5 text-left"
                  onClick={() => setPendingSpeed(preset.mode)}
                >
                  <span className="font-semibold">
                    {preset.label} · {preset.multiplier}x
                  </span>
                  <span className="text-xs font-normal opacity-80">
                    Pres {pace.presCycle} · Senate {pace.senateCycle} · Bills{" "}
                    {pace.billStage}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <AlertDialog
        open={pendingSpeed !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSpeed(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Switch game speed to {pendingSpeed}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Every live bill, election, and reveal deadline is rescaled
              proportionally, so in-flight items keep their progress. Overdue
              items advance on the next scheduler tick. The new pace sticks
              until you change it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={speedSaving} onClick={applyGameSpeed}>
              {speedSaving ? "Switching…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section className="my-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-destructive">Delete all other accounts</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Permanently removes database and Firebase accounts, except
              ajstrongdev@pm.me and jenewland1999@gmail.com. Related records
              linked by account IDs may also be removed. This cannot be undone.
            </p>
          </div>
          <Button variant="destructive" onClick={() => setPurgeOpen(true)}>
            <Trash2 className="mr-2 size-4" /> Delete other accounts
          </Button>
        </div>
      </section>

      <AlertDialog
        open={purgeOpen}
        onOpenChange={(open) => {
          if (!purgeLoading) setPurgeOpen(open);
          if (!open) setPurgeConfirmation("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete every other account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all Firebase accounts and database user
              profiles except ajstrongdev@pm.me and jenewland1999@gmail.com.
              Votes and other records tied to removed accounts may be deleted.
              There is no undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="purge-confirmation">
              Type DELETE ALL OTHER ACCOUNTS to continue
            </Label>
            <Input
              id="purge-confirmation"
              value={purgeConfirmation}
              onChange={(event) => setPurgeConfirmation(event.target.value)}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purgeLoading}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={purgeLoading || purgeConfirmation !== "DELETE ALL OTHER ACCOUNTS"}
              onClick={purgeOtherAccounts}
            >
              {purgeLoading ? "Deleting accounts..." : "Permanently delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
