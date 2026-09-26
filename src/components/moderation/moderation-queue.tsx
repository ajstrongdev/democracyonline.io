import { useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getInvitationAncestry,
  getModerationQueue,
  moderatePlayer,
} from "@/lib/server/moderation";

type QueueData = Awaited<ReturnType<typeof getModerationQueue>>;
type Ancestry = Awaited<ReturnType<typeof getInvitationAncestry>>["ancestry"];

export function ModerationQueue({ initialQueue }: { initialQueue: QueueData }) {
  const [queue, setQueue] = useState(initialQueue);
  const [ancestry, setAncestry] = useState<Record<number, Ancestry>>({});
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await getModerationQueue();
      setQueue(result);
    } finally {
      setLoading(false);
    }
  };

  const act = async (
    targetUserId: number,
    action: "resolve" | "dismiss" | "suspend" | "restore",
    ids: { reportId?: number; flagId?: number },
  ) => {
    const reason = window.prompt("Reason for this audited moderation action:");
    if (!reason?.trim()) return;
    try {
      await moderatePlayer({
        data: { targetUserId, action, reason, ...ids },
      });
      toast.success("Moderation action recorded");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  };

  const loadAncestry = async (userId: number) => {
    try {
      const result = await getInvitationAncestry({ data: { userId } });
      setAncestry((current) => ({
        ...current,
        [userId]: result.ancestry,
      }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load ancestry",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Moderation Queue</h1>
          <p className="text-muted-foreground">
            Review player reports and explainable automatic flags.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automatic Flags</CardTitle>
          <CardDescription>
            Scores are bounded at 100; flags open at 40.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {queue.flags.map((flag) => {
            const userId = flag.userId;
            const explanation = flag.explanation;
            return (
              <div key={flag.id} className="rounded-md border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{flag.username}</strong>
                  <Badge variant="destructive">
                    <ShieldAlert className="h-3 w-3" /> Score{" "}
                    {flag.suspicionScore}
                  </Badge>
                </div>
                <ul className="my-3 space-y-1 text-sm text-muted-foreground">
                  {(explanation.contributions ?? []).map((item) => (
                    <li key={item.signal}>
                      +{item.points}: {item.explanation}
                    </li>
                  ))}
                </ul>
                <Ancestry ancestry={ancestry[userId]} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadAncestry(userId)}
                  >
                    View ancestry
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(userId, "resolve", { flagId: flag.id })}
                  >
                    Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => act(userId, "suspend", { flagId: flag.id })}
                  >
                    Suspend
                  </Button>
                </div>
              </div>
            );
          })}
          {!queue.flags.length && (
            <p className="text-sm text-muted-foreground">
              No open automatic flags.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Player Reports</CardTitle>
          <CardDescription>
            Reporter identities remain inside the moderation queue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {queue.reports.map((report) => {
            const userId = report.reportedUserId;
            return (
              <div key={report.id} className="rounded-md border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{report.reportedUsername}</strong>
                  <Badge variant="outline">
                    {report.category.replaceAll("_", " ")}
                  </Badge>
                </div>
                <p className="mt-2 text-sm">{report.details}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Reported by {report.reporterUsername} on{" "}
                  {new Date(report.createdAt).toLocaleString()}
                </p>
                <Ancestry ancestry={ancestry[userId]} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadAncestry(userId)}
                  >
                    View ancestry
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      act(userId, "dismiss", { reportId: report.id })
                    }
                  >
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      act(userId, "resolve", { reportId: report.id })
                    }
                  >
                    Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      act(userId, "suspend", { reportId: report.id })
                    }
                  >
                    Suspend
                  </Button>
                </div>
              </div>
            );
          })}
          {!queue.reports.length && (
            <p className="text-sm text-muted-foreground">No pending reports.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Ancestry({ ancestry }: { ancestry?: Ancestry }) {
  if (!ancestry) return null;
  return (
    <div className="mt-3 rounded bg-muted/50 p-3 text-xs">
      <span className="font-medium">Invitation ancestry: </span>
      {ancestry.length
        ? ancestry
            .map(
              (item) =>
                `${item.username}${item.isAncestryRoot ? " (root)" : ""}`,
            )
            .join(" <- ")
        : "No invitation ancestor (root account)"}
    </div>
  );
}
