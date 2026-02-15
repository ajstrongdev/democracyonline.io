import { useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { purgeUserFromDatabase } from "@/lib/server/admin";

interface DatabaseUser {
  id: number;
  email: string;
  username: string;
  role: string | null;
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

  const handlePurgeUser = async () => {
    if (!userToDelete) return;

    try {
      setLoading(true);
      await purgeUserFromDatabase({ data: { userId: userToDelete.id } });
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error) {
      console.error("Error purging user:", error);
      alert("Failed to purge user");
    } finally {
      setLoading(false);
    }
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
              <CardDescription>Purge users from the database</CardDescription>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => (
              <Card key={user.id}>
                <CardHeader>
                  <CardTitle>{user.username}</CardTitle>
                  <CardDescription className="truncate">
                    {user.email}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-semibold">ID:</span> {user.id}
                    </div>
                    <div>
                      <span className="font-semibold">Role:</span>{" "}
                      {user.role || "None"}
                    </div>
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
                <CardFooter>
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
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePurgeUser}>
              Purge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
