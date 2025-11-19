"use client";

import { Copy, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

interface AccessToken {
  id: number;
  token: string;
  createdAt: string;
}

interface AccessTokenManagerProps {
  onRefresh?: () => void | Promise<void>;
}

export default function AccessTokenManager({
  onRefresh,
}: AccessTokenManagerProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState<AccessToken | null>(null);

  const {
    data: tokens = [],
    isLoading: loading,
    refetch,
  } = trpc.admin.accessTokensList.useQuery();

  const createToken = trpc.admin.accessTokenCreate.useMutation({
    onSuccess: async () => {
      toast.success("Access token created successfully");
      await refetch();
      if (onRefresh) await onRefresh();
    },
    onError: () => toast.error("Failed to create access token"),
  });

  const deleteToken = trpc.admin.accessTokenDelete.useMutation({
    onSuccess: async () => {
      toast.success("Access token deleted successfully");
      setDeleteDialogOpen(false);
      setTokenToDelete(null);
      await refetch();
      if (onRefresh) await onRefresh();
    },
    onError: () => toast.error("Failed to delete access token"),
  });

  const handleCreateToken = async () => {
    createToken.mutate();
  };

  const handleDeleteToken = async () => {
    if (!tokenToDelete) return;
    deleteToken.mutate({ tokenId: tokenToDelete.id });
  };

  const copyToClipboard = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success("Token copied to clipboard");
  };

  const openDeleteDialog = (token: AccessToken) => {
    setTokenToDelete(token);
    setDeleteDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

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
                onClick={() => refetch()}
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
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading tokens...
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No access tokens found. Create one to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {tokens.map((token) => (
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
