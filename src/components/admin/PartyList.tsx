"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import axios from "axios";
import { auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { RefreshCw, Search, Trash2 } from "lucide-react";
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

interface Party {
  id: number;
  name: string;
  description: string;
  economic_position: number;
  social_position: number;
  leader_id: number | null;
  leader_username: string | null;
  member_count: number;
  created_at: string;
}

interface PartyListProps {
  initialParties: Party[];
  onRefresh?: () => void | Promise<void>;
}

export default function PartyList({
  initialParties,
  onRefresh,
}: PartyListProps) {
  const [user] = useAuthState(auth);
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [loading, setLoading] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null);

  // Update parties when initialParties changes
  useEffect(() => {
    setParties(initialParties);
  }, [initialParties]);

  // Filter parties based on search query
  const filteredParties = useMemo(() => {
    if (!searchQuery.trim()) return parties;

    const query = searchQuery.toLowerCase();
    return parties.filter(
      (p) =>
        p.name?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.leader_username?.toLowerCase().includes(query)
    );
  }, [parties, searchQuery]);

  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
  };

  const handleDeleteClick = (party: Party) => {
    setPartyToDelete(party);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!user || !partyToDelete) return;

    setLoading(partyToDelete.id);
    setDeleteDialogOpen(false);

    try {
      // Get the current user's ID token
      const idToken = await user.getIdToken();

      await axios.post(
        "/api/admin/delete-party",
        {
          partyId: partyToDelete.id,
        },
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      // Update local state
      setParties((prevParties) =>
        prevParties.filter((p) => p.id !== partyToDelete.id)
      );

      toast.success(`Party "${partyToDelete.name}" deleted successfully`);
      setPartyToDelete(null);
    } catch (error) {
      toast.error("Failed to delete party");
      console.error("Error deleting party:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Party Management</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                      Leader: {party.leader_username || "None"} • Members:{" "}
                      {party.member_count}
                    </span>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteClick(party)}
                    disabled={loading === party.id}
                    className="gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    {loading === party.id ? "..." : "Delete"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground space-x-3">
                  <span>
                    Economic: {party.economic_position?.toFixed(1) || "N/A"}
                  </span>
                  <span>
                    Social: {party.social_position?.toFixed(1) || "N/A"}
                  </span>
                  {party.created_at && (
                    <span>
                      Created: {new Date(party.created_at).toLocaleDateString()}
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
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{partyToDelete?.name}</strong>?
              <br />
              <br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>
                  Remove all {partyToDelete?.member_count} members from the
                  party
                </li>
                <li>Delete all party stances</li>
                <li>Permanently delete the party</li>
              </ul>
              <br />
              This action cannot be undone.
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
