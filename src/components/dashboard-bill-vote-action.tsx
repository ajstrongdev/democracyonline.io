import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { voteOnHouseBill } from "@/lib/server/house-bills";
import { voteOnSenateBill } from "@/lib/server/senate-bills";
import { voteOnPresidentialBill } from "@/lib/server/oval-office-bills";

export function DashboardBillVoteAction({ billId, title, stage, userId }: {
  billId: number;
  title: string;
  stage: string;
  userId: number;
}) {
  const router = useRouter();
  const [voteYes, setVoteYes] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (voteYes === null || busy) return;
    setBusy(true);
    try {
      const vote = stage === "House" ? voteOnHouseBill : stage === "Senate" ? voteOnSenateBill : voteOnPresidentialBill;
      await vote({ data: { userId, billId, voteYes } });
      setVoteYes(null);
      await router.invalidate();
      toast.success("Vote recorded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record vote");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={() => setVoteYes(true)}>Vote for</Button>
        <Button size="sm" variant="outline" onClick={() => setVoteYes(false)}>Vote against</Button>
      </div>
      <Dialog open={voteYes !== null} onOpenChange={(open) => { if (!open && !busy) setVoteYes(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm your vote</DialogTitle>
            <DialogDescription>Vote {voteYes ? "for" : "against"} “{title}”? This vote will be recorded.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setVoteYes(null)}>Cancel</Button>
            <Button disabled={busy} onClick={submit}>{busy ? "Recording…" : "Confirm vote"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
