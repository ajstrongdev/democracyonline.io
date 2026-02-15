import { useEffect, useState } from "react";
import { Copy, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { createAccessToken, deleteAccessToken } from "@/lib/server/admin";

interface AccessToken {
  id: number;
  token: string;
  createdAt: Date | null;
}

interface AccessTokenManagerProps {
  initialTokens: Array<AccessToken>;
  onRefresh: () => void | Promise<void>;
}

export default function AccessTokenManager({
  initialTokens,
  onRefresh,
}: AccessTokenManagerProps) {
  const [tokens, setTokens] = useState<Array<AccessToken>>(initialTokens);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState<AccessToken | null>(null);

  useEffect(() => {
    setTokens(initialTokens);
  }, [initialTokens]);

  const handleCreateToken = async () => {
    try {
      setLoading(true);
      const result = await createAccessToken();
      setTokens((prev) => [...prev, result.token]);
    } catch (error) {
      console.error("Error creating token:", error);
      toast.error("Failed to create access token");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteToken = async () => {
    if (!tokenToDelete) return;

    try {
      setLoading(true);
      await deleteAccessToken({ data: { tokenId: tokenToDelete.id } });
      setTokens((prev) => prev.filter((t) => t.id !== tokenToDelete.id));
      setDeleteDialogOpen(false);
      setTokenToDelete(null);
    } catch (error) {
      console.error("Error deleting token:", error);
      toast.error("Failed to delete access token");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      toast.success("Token copied to clipboard");
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const openDeleteDialog = (token: AccessToken) => {
    setTokenToDelete(token);
    setDeleteDialogOpen(true);
  };

  const handleRefresh = async () => {
    setLoading(true);
    await onRefresh();
    setLoading(false);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Unknown";
    return new Date(date).toLocaleString();
  };

  const sortedTokens = [...tokens].sort((a, b) => b.id - a.id);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Access Tokens</CardTitle>
              <CardDescription>
                Manage access tokens for user registration
              </CardDescription>
            </div>
            <div className="flex gap-2">
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
              <Button size="sm" onClick={handleCreateToken} disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                Create Token
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No access tokens found. Create one to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono truncate block max-w-md">
                        {token.token}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(token.token)}
                        className="shrink-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Created: {formatDate(token.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openDeleteDialog(token)}
                    disabled={loading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Access Token</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this access token? This action
              cannot be undone and users will no longer be able to register
              using this token.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteToken}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
