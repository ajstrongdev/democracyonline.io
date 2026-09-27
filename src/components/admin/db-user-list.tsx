import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ShieldCheck, Ban } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { purgeUserFromDatabase, setPlayerBan } from "@/lib/server/admin";
import { setModerationRole } from "@/lib/server/moderation";

interface DatabaseUser {
  id: number;
  email: string;
  username: string;
  role: string | null;
  moderationRole: string;
  isActive: boolean | null;
  partyId: number | null;
  createdAt: Date | null;
}

interface DBUserListProps {
  initialUsers: Array<DatabaseUser>;
  onRefresh: () => void | Promise<void>;
}

export default function DBUserList({
  initialUsers,
  onRefresh,
}: DBUserListProps) {
  const [users, setUsers] = useState<Array<DatabaseUser>>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<DatabaseUser | null>(null);
  const [reason, setReason] = useState("");

  const handlePurgeUser = async () => {
    if (!userToDelete) return;

    try {
      setLoading(true);
      if (reason.trim().length < 3) throw new Error("A deletion reason is required.");
      await purgeUserFromDatabase({ data: { userId: userToDelete.id, reason } });
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      setReason("");
      toast.success("User deleted and recorded in the audit log");
    } catch (error) {
      console.error("Error purging user:", error);
      toast.error("Failed to purge user");
    } finally {
      setLoading(false);
    }
  };

  const manageRoleOrBan = async (user: DatabaseUser, action: "ban" | "unban" | "promote" | "demote") => {
    const why = window.prompt(`Reason for ${action} of ${user.username}:`);
    if (!why || why.trim().length < 3) return;
    try {
      if (action === "ban" || action === "unban") {
        await setPlayerBan({ data: { userId: user.id, banned: action === "ban", reason: why } });
        setUsers((prev) => prev.map((item) => item.id === user.id ? { ...item, isActive: action !== "ban" } : item));
      } else {
        await setModerationRole({ data: { userId: user.id, role: action === "promote" ? "moderator" : "player", reason: why } });
        setUsers((prev) => prev.map((item) => item.id === user.id ? { ...item, moderationRole: action === "promote" ? "moderator" : "player" } : item));
      }
      toast.success("Action completed and recorded");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Action failed"); }
  };

  const openDeleteDialog = (user: DatabaseUser) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleRefresh = async () => {
    setLoading(true);
    await onRefresh();
    setLoading(false);
  };

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.username.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.id.toString().toLowerCase().includes(query) ||
      user.role?.toLowerCase().includes(query)
    );
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Database Users</CardTitle>
              <CardDescription>Search player profiles, manage moderator access, and review account status.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Search by username, email, ID, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="overflow-hidden transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                  <CardTitle>{user.username}</CardTitle>
                  <CardDescription className="truncate">
                    {user.email}
                  </CardDescription>
                    </div>
                    <Badge variant={user.isActive === false ? "destructive" : user.moderationRole === "moderator" ? "default" : "secondary"} className="shrink-0">{user.isActive === false ? "Banned" : user.moderationRole === "moderator" ? "Moderator" : "Player"}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-semibold">ID:</span> {user.id}
                    </div>
                    <div>
                      <span className="font-semibold">Role:</span>{" "}
                      {user.role || "None"} · {user.moderationRole || "player"}
                    </div>
                    {user.isActive === false && <div className="font-medium text-destructive">Banned</div>}
                    <div>
                      <span className="font-semibold">Party ID:</span>{" "}
                      {user.partyId || "None"}
                    </div>
                    {user.createdAt && (
                      <div>
                        <span className="font-semibold">Created:</span>{" "}
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col items-stretch gap-2 pt-0">
                  <div className="grid w-full grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => manageRoleOrBan(user, user.isActive === false ? "unban" : "ban")}><Ban className="mr-1 size-4" />{user.isActive === false ? "Unban" : "Ban"}</Button>
                    <Button variant="outline" size="sm" onClick={() => manageRoleOrBan(user, user.moderationRole === "moderator" ? "demote" : "promote")}><ShieldCheck className="mr-1 size-4" />{user.moderationRole === "moderator" ? "Remove mod" : "Make mod"}</Button>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => openDeleteDialog(user)}
                    className="w-full"
                    disabled={loading}
                  >
                    Purge User
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              {searchQuery
                ? "No users match your search query."
                : "No users found in the database."}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge User from Database</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to purge {userToDelete?.username} from the
              database? This will permanently delete all their data including
              bills, votes, and party membership. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2"><label htmlFor="delete-reason" className="text-sm font-medium">Deletion reason (required)</label><Input id="delete-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this account is being deleted" /></div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={loading || reason.trim().length < 3} onClick={handlePurgeUser}>
              Purge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
