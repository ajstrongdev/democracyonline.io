"use client";

import { RefreshCw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

type Party = {
  id: number;
  name: string;
  description: string | null;
  leaderId: number | null;
  leaderUsername: string | null;
  memberCount: number;
  createdAt: string;
};

export default function PartyList() {
  const utils = trpc.useUtils();

  // Fetch parties directly via tRPC
  const {
    data: parties = [],
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.admin.listParties.useQuery();

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const deleteParty = trpc.admin.deleteParty.useMutation({
    onSuccess: async () => {
      toast.success("Party deleted successfully");
      // Refresh list after delete
      await refetch();
      // Invalidate generic caches for safety
      await utils.party.list.invalidate();
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to delete party");
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteClick = (party: Party) => {
    setPartyToDelete(party);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!partyToDelete) return;
    setDeletingId(partyToDelete.id);
    setDeleteDialogOpen(false);
    try {
      await deleteParty.mutateAsync({ partyId: partyToDelete.id });
      setPartyToDelete(null);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredParties = useMemo(() => {
    if (!searchQuery.trim()) return parties;
    const q = searchQuery.toLowerCase();
    return parties.filter((p) => {
      return (
        (p.name || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (p.leaderUsername || "").toLowerCase().includes(q)
      );
    });
  }, [parties, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Party Management</h2>
        </div>
        <div className="text-muted-foreground">Loading parties...</div>
      </div>
    );
  }

  if (isError) {
    if (error?.data?.code === "FORBIDDEN") {
      return (
        <div className="p-6">
          <p className="text-destructive">
            Access denied. Admin privileges required.
          </p>
        </div>
      );
    }
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load parties.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Party Management</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh party list"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          Found {filteredParties.length} part
          {filteredParties.length !== 1 ? "ies" : "y"}
        </p>
      )}

      <div className="grid gap-3">
        {filteredParties.map((party) => (
          <Card key={party.id} className="hover:bg-accent/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base leading-tight">
                    {party.name}
                  </CardTitle>
                  <CardDescription className="mt-1 space-y-0.5">
                    {party.description && (
                      <span className="block text-xs line-clamp-2">
                        {party.description}
                      </span>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      Leader: {party.leaderUsername || "None"} • Members:{" "}
                      {party.memberCount}
                    </span>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteClick(party)}
                    disabled={deletingId === party.id || deleteParty.isPending}
                    className="gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    {deletingId === party.id || deleteParty.isPending
                      ? "..."
                      : "Delete"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {party.createdAt && (
                    <span>
                      Created: {new Date(party.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredParties.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery
                ? "No parties found matching your search."
                : "No parties to display."}
            </p>
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Party</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Are you sure you want to delete{" "}
                  <strong>{partyToDelete?.name}</strong>?
                </p>
                <p className="mt-4">This will:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>
                    Remove all {partyToDelete?.memberCount} members from the
                    party
                  </li>
                  <li>Delete all party stances</li>
                  <li>Permanently delete the party</li>
                </ul>
                <p className="mt-4">This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Party
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
