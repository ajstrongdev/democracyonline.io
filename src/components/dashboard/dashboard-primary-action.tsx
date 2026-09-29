import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  declarePrimaryCandidate,
  withdrawPrimaryCandidate,
} from "@/lib/server/organizations/primaries";

export function DashboardPrimaryAction({
  withdraw = false,
}: {
  withdraw?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const declare = async () => {
    setSubmitting(true);
    try {
      await declarePrimaryCandidate();
      setOpen(false);
      await router.invalidate();
      toast.success("You are standing in the presidential primary");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not declare candidacy",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const withdrawCandidacy = async () => {
    setSubmitting(true);
    try {
      await withdrawPrimaryCandidate({ data: {} });
      setOpen(false);
      await router.invalidate();
      toast.success("You withdrew from the presidential primary");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not withdraw candidacy",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant={withdraw ? "destructive" : "default"}
        onClick={() => setOpen(true)}
      >
        {withdraw ? "Withdraw" : "Stand now"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {withdraw
                ? "Withdraw from your presidential primary?"
                : "Stand in your presidential primary?"}
            </DialogTitle>
            <DialogDescription>
              {withdraw
                ? "Your candidacy will be removed from your party or coalition’s primary. Votes cast for you will be discarded."
                : "Your name will appear in your party or coalition’s primary. Confirm your candidacy."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant={withdraw ? "destructive" : "default"}
              disabled={submitting}
              onClick={withdraw ? withdrawCandidacy : declare}
            >
              {submitting
                ? withdraw
                  ? "Withdrawing…"
                  : "Declaring…"
                : withdraw
                  ? "Withdraw"
                  : "Confirm candidacy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
