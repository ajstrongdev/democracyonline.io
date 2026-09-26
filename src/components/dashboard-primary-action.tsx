import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { declarePrimaryCandidate } from "@/lib/server/primaries";

export function DashboardPrimaryAction() {
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
      toast.error(error instanceof Error ? error.message : "Could not declare candidacy");
    } finally {
      setSubmitting(false);
    }
  };

  return <>
    <Button size="sm" onClick={() => setOpen(true)}>Stand now</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stand in your presidential primary?</DialogTitle>
          <DialogDescription>Your name will appear in your party or coalition’s primary. Confirm your candidacy.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={submitting} onClick={declare}>{submitting ? "Declaring…" : "Confirm candidacy"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
