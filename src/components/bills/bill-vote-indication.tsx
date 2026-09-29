import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { indicateBillVote } from "@/lib/server/bills/vote-indications";

export function BillVoteIndication({
  billId,
  stage,
  voteYes,
  enforcedPosition,
}: {
  billId: number;
  stage: "House" | "Senate" | "Presidential";
  voteYes: boolean | null;
  enforcedPosition?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const indicate = async (choice: boolean) => {
    if (
      enforcedPosition &&
      choice !== (enforcedPosition === "For") &&
      !window.confirm(
        "This party whip is enforced. If your indicated vote remains against the party line when your chamber's vote closes, you will be ejected from your party. You can change it until then. Continue?",
      )
    )
      return;
    setBusy(true);
    try {
      await indicateBillVote({ data: { billId, stage, voteYes: choice } });
      await router.invalidate();
      toast.success("Vote indication saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not indicate vote",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Indicate your vote before this bill enters the {stage} stage. You can
        change it until then; if you still hold this office when the stage
        opens, it will be recorded automatically.
      </p>
      {voteYes !== null && (
        <p className="font-semibold">
          Current indication:{" "}
          {stage === "Presidential"
            ? voteYes
              ? "Sign"
              : "Veto"
            : voteYes
              ? "For"
              : "Against"}
        </p>
      )}
      {enforcedPosition && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          Enforced party whip: {enforcedPosition}. A contrary vote recorded when
          the stage opens will eject you from your party.
        </p>
      )}
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => indicate(true)}>
          {stage === "Presidential" ? "Indicate Sign" : "Indicate For"}
        </Button>
        <Button
          disabled={busy}
          variant="outline"
          onClick={() => indicate(false)}
        >
          {stage === "Presidential" ? "Indicate Veto" : "Indicate Against"}
        </Button>
      </div>
    </div>
  );
}
