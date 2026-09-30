import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  searchAdminBills,
  setAdminBillStage,
} from "@/lib/server/admin/bill-stage";

type Bill = Awaited<ReturnType<typeof searchAdminBills>>[number];
type Stage = "Committee" | "House" | "Senate" | "Presidential";
const stages: Array<{ value: Stage; label: string }> = [
  { value: "Committee", label: "Committee" },
  { value: "House", label: "House voting" },
  { value: "Senate", label: "Senate voting" },
  { value: "Presidential", label: "Presidential voting" },
];

export function BillStageControl() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<Bill>>([]);
  const [selected, setSelected] = useState<Bill | null>(null);
  const [stage, setStage] = useState<Stage>("House");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let active = true;
    searchAdminBills({ data: { query: "" } })
      .then((bills) => {
        if (active) setResults(bills);
      })
      .catch(() => {
        if (active) toast.error("Could not load bills");
      });
    return () => {
      active = false;
    };
  }, []);

  const search = async () => {
    setLoading(true);
    try {
      const bills = await searchAdminBills({ data: { query } });
      setResults(bills);
      setSelected(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not search bills",
      );
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await setAdminBillStage({
        data: { billId: selected.id, stage },
      });
      setSelected(updated);
      setResults((previous) =>
        previous.map((bill) => (bill.id === updated.id ? updated : bill)),
      );
      setConfirmOpen(false);
      await router.invalidate();
      toast.success(
        `Bill #${updated.id} moved to ${stage === "Committee" ? "Committee" : `${stage} voting`}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not change bill stage",
      );
    } finally {
      setSaving(false);
    }
  };

  const currentStage =
    selected?.status === "Committee"
      ? "Committee"
      : selected?.status === "Voting" || selected?.status === "Queued"
        ? selected.stage
        : null;

  return (
    <div className="mt-7 border-t pt-6">
      <h3 className="text-lg font-semibold">Move a bill to another stage</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Admin override for any bill, including defeated or enacted bills. Search
        by title or bill number.
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <Label htmlFor="admin-bill-search" className="sr-only">
          Bill title or number
        </Label>
        <Input
          id="admin-bill-search"
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Bill title or #"
        />
        <Button type="submit" variant="outline" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="grid min-w-0 gap-1.5 text-sm font-medium">
          Bill
          <select
            className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm"
            value={selected?.id ?? ""}
            onChange={(event) =>
              setSelected(
                results.find(
                  (bill) => bill.id === Number(event.target.value),
                ) ?? null,
              )
            }
          >
            <option value="">Select a bill</option>
            {results.map((bill) => (
              <option key={bill.id} value={bill.id}>
                #{bill.id} · {bill.title} ({bill.status}
                {bill.status === "Committee" ||
                bill.status === "Voting" ||
                bill.status === "Queued"
                  ? ` / ${bill.stage}`
                  : ""}
                )
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Destination
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={stage}
            onChange={(event) => setStage(event.target.value as Stage)}
          >
            {stages.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={!selected || saving || currentStage === stage}
          onClick={() => setConfirmOpen(true)}
        >
          Move bill
        </Button>
      </div>
      {!results.length && (
        <p className="mt-3 text-sm text-muted-foreground">No matching bills.</p>
      )}
      {selected && (
        <p className="mt-3 text-sm text-muted-foreground">
          Currently: {selected.status}
          {selected.status === "Committee" ||
          selected.status === "Voting" ||
          selected.status === "Queued"
            ? ` / ${selected.stage}`
            : ""}
          {selected.nationEffectsAppliedAt
            ? " · Nation effects already applied"
            : ""}
        </p>
      )}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!saving) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move bill #{selected?.id} to{" "}
              {stage === "Committee" ? "Committee" : `${stage} voting`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This starts a new stage timer and reopens the bill if it was
              finished. Existing votes are kept, and skipped stages will not
              publish a result or enforce a whip. If the bill already changed
              the nation, those effects are not reversed. Committee assessments
              will be locked again when committee closes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={apply}>
              {saving ? "Moving…" : "Confirm move"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
