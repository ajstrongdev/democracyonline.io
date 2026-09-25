import { useEffect, useState } from "react";
import { Copy, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { createInviteLink } from "@/lib/invitations/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  createInvitation,
  listMyInvitations,
  revokeInvitation,
} from "@/lib/server/invitations";

type Invitation = Awaited<ReturnType<typeof listMyInvitations>>[number];

export function InvitationManager() {
  const [invitations, setInvitations] = useState<Array<Invitation>>([]);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      setInvitations(await listMyInvitations());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load invitations",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const create = async () => {
    setLoading(true);
    try {
      const result = await createInvitation();
      setNewLink(createInviteLink(window.location.origin, result.token));
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create invitation",
      );
      setLoading(false);
    }
  };

  const revoke = async (invitationId: number) => {
    setLoading(true);
    try {
      await revokeInvitation({ data: { invitationId } });
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not revoke invitation",
      );
      setLoading(false);
    }
  };

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy invite link");
    }
  };

  const status = (invitation: Invitation) => {
    if (invitation.redeemedAt) return "Redeemed";
    if (invitation.revokedAt) return "Revoked";
    if (new Date(invitation.expiresAt) <= new Date()) return "Expired";
    return "Open";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Invite links</CardTitle>
          <CardDescription>
            Create single-use invite links to share with new players. Each link
            is shown only once and expires after seven days.
          </CardDescription>
        </div>
        <Button size="sm" onClick={create} disabled={loading}>
          <Plus className="h-4 w-4" /> Create
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {newLink && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="mb-2 text-sm font-medium">New invite link</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all text-xs">
                {newLink}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(newLink)}
              >
                <Copy className="h-4 w-4" /> Copy
              </Button>
            </div>
          </div>
        )}
        <div className="divide-y rounded-md border">
          {invitations.map((invitation) => {
            const invitationStatus = status(invitation);
            return (
              <div
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
              >
                <div>
                  <code>{invitation.tokenPrefix}...</code>
                  <p className="text-xs text-muted-foreground">
                    {invitation.redeemedByUsername
                      ? `Redeemed by ${invitation.redeemedByUsername}`
                      : `Expires ${new Date(invitation.expiresAt).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      invitationStatus === "Open" ? "default" : "secondary"
                    }
                  >
                    {invitationStatus}
                  </Badge>
                  {invitationStatus === "Open" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => revoke(invitation.id)}
                      disabled={loading}
                      aria-label="Revoke invitation"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {!invitations.length && !loading && (
            <p className="p-4 text-sm text-muted-foreground">
              No invite links yet.
            </p>
          )}
          {loading && !invitations.length && (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading invite links
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
