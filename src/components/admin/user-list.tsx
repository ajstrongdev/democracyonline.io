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
import { Badge } from "@/components/ui/badge";
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
import { deleteFirebaseUser, toggleUserDisabled } from "@/lib/server/admin";

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

interface UserListProps {
  initialUsers: Array<FirebaseUser>;
  onRefresh: () => void | Promise<void>;
}

export default function UserList({ initialUsers, onRefresh }: UserListProps) {
  const [users, setUsers] = useState<Array<FirebaseUser>>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<FirebaseUser | null>(null);

  const handleToggleDisabled = async (uid: string, currentStatus: boolean) => {
    try {
      setLoading(true);
      await toggleUserDisabled({ data: { uid, disabled: !currentStatus } });
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === uid ? { ...u, disabled: !currentStatus } : u,
        ),
      );
    } catch (error) {
      console.error("Error toggling user:", error);
      alert("Failed to update user status");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setLoading(true);
      await deleteFirebaseUser({ data: { uid: userToDelete.uid } });
      setUsers((prev) => prev.filter((u) => u.uid !== userToDelete.uid));
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user");
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = (user: FirebaseUser) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.displayName?.toLowerCase().includes(query) ||
      user.uid.toLowerCase().includes(query)
    );
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Firebase Users</CardTitle>
              <CardDescription>
                Manage Firebase authentication users
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
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
              placeholder="Search by email, name, or UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => (
              <Card key={user.uid}>
                <CardHeader>
                  <div className="">
                    <div className="my-2">
                      <CardTitle className="truncate">{user.email}</CardTitle>
                    </div>
                    {user.disabled && (
                      <Badge variant="destructive" className="my-2">
                        Disabled
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-semibold">UID:</span>{" "}
                      <span className="text-muted-foreground break-all">
                        {user.uid}
                      </span>
                    </div>
                    {user.creationTime && (
                      <div>
                        <span className="font-semibold">Created:</span>{" "}
                        {new Date(user.creationTime).toLocaleDateString()}
                      </div>
                    )}
                    {user.lastSignInTime && (
                      <div>
                        <span className="font-semibold">Last Sign In:</span>{" "}
                        {new Date(user.lastSignInTime).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    variant={user.disabled ? "default" : "outline"}
                    onClick={() =>
                      handleToggleDisabled(user.uid, user.disabled)
                    }
                    disabled={loading}
                    className="flex-1"
                  >
                    {user.disabled ? "Enable" : "Disable"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => openDeleteDialog(user)}
                    disabled={loading}
                    className="flex-1"
                  >
                    Delete
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              {searchQuery
                ? "No users match your search query."
                : "No users found."}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {userToDelete?.email}? This will
              permanently delete their Firebase account. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
