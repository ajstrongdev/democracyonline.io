import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, ScrollText, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageDialog } from "@/components/message-dialog";
import { PartyCompositionBar } from "@/components/wiki/party-composition-bar";
import { createBill } from "@/lib/server/bills";
import { hasVotedOnHouseBill, voteOnHouseBill } from "@/lib/server/house-bills";
import {
  hasVotedOnPresidentialBill,
  voteOnPresidentialBill,
} from "@/lib/server/oval-office-bills";
import {
  hasVotedOnSenateBill,
  voteOnSenateBill,
} from "@/lib/server/senate-bills";
import { ReferenceInsert } from "@/components/reference-insert";
import { PlayerAvatar } from "@/components/players/player-avatar";

export type BillDeskChamber = "House" | "Senate" | "Presidential";

type DeskBill = {
  id: number;
  title: string;
  content: string;
  creator: string | null;
  votes: { yes: number; no: number };
};

type DeskMember = {
  id: number;
  username: string;
  photoUrl: string | null;
  partyName: string | null;
  partyColor: string | null;
};

export type BillDeskData = Record<
  BillDeskChamber,
  { bills: Array<DeskBill>; members: Array<DeskMember> }
>;

export function NewBillDialog({
  userId,
  autoOpen = false,
}: {
  userId: number | null | undefined;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!userId) return setError("Sign in to draft a bill.");
    if (!title.trim() || title.length > 255)
      return setError("Enter a title no longer than 255 characters.");
    if (content.trim().length < 8)
      return setError("The official text must be at least 8 characters.");
    setSubmitting(true);
    setError(null);
    try {
      await createBill({
        data: {
          title: title.trim(),
          content: content.trim(),
          creatorId: userId,
        },
      });
      setTitle("");
      setContent("");
      setOpen(false);
      await router.invalidate();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create bill",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Draft a bill</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto rounded-sm sm:max-w-2xl">
        <DialogHeader className="border-b pb-4">
          <p className="wiki-kicker">Legislative submission</p>
          <DialogTitle className="font-serif text-3xl">
            Draft a new bill
          </DialogTitle>
          <DialogDescription>
            New proposals enter the Senate Committee before House consideration.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="new-bill-title">Title</Label>
            <Input
              id="new-bill-title"
              value={title}
              maxLength={255}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Public Infrastructure Act"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="new-bill-content">Official text</Label>
              <ReferenceInsert
                textareaId="new-bill-content"
                value={content}
                onChange={setContent}
              />
            </div>
            <Textarea
              id="new-bill-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={10}
              placeholder="Set out the proposal in detail..."
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BillDeskDialog({
  data,
  user,
  initialChamber = "House",
  autoOpen = false,
}: {
  data: BillDeskData;
  user: { id: number; role: string | null } | null;
  initialChamber?: BillDeskChamber;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [chamber, setChamber] = useState<BillDeskChamber>(initialChamber);
  const [voted, setVoted] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingVote, setPendingVote] = useState<{
    billId: number;
    title: string;
    voteYes: boolean;
  } | null>(null);
  const chamberData = data[chamber];
  const role =
    chamber === "House"
      ? "Representative"
      : chamber === "Senate"
        ? "Senator"
        : "President";
  const eligible = user?.role === role;

  useEffect(() => {
    if (!open || !eligible || !user) return;
    let cancelled = false;
    const check =
      chamber === "House"
        ? hasVotedOnHouseBill
        : chamber === "Senate"
          ? hasVotedOnSenateBill
          : hasVotedOnPresidentialBill;
    Promise.all(
      chamberData.bills.map(
        async (bill) =>
          [
            bill.id,
            await check({ data: { userId: user.id, billId: bill.id } }),
          ] as const,
      ),
    ).then((rows) => {
      if (!cancelled) setVoted(Object.fromEntries(rows));
    });
    return () => {
      cancelled = true;
    };
  }, [chamber, chamberData.bills, eligible, open, user]);

  const castVote = async (billId: number, voteYes: boolean) => {
    if (!user || !eligible || voted[billId]) return;
    setSubmitting(billId);
    setError(null);
    try {
      const vote =
        chamber === "House"
          ? voteOnHouseBill
          : chamber === "Senate"
            ? voteOnSenateBill
            : voteOnPresidentialBill;
      await vote({ data: { userId: user.id, billId, voteYes } });
      setVoted((current) => ({ ...current, [billId]: true }));
      await router.invalidate();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not record vote",
      );
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <ScrollText className="h-4 w-4" /> Chamber desks
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[92svh] overflow-y-auto rounded-sm p-0 sm:max-w-5xl">
          <DialogHeader className="border-b px-5 pb-5 pt-6 sm:px-7">
            <p className="wiki-kicker">Live legislative business</p>
            <DialogTitle className="font-serif text-3xl">
              Chamber desks
            </DialogTitle>
            <DialogDescription>
              Review active bills, cast an eligible vote, and inspect the
              serving roster.
            </DialogDescription>
          </DialogHeader>
          <div className="flex overflow-x-auto border-b px-3 sm:px-5">
            {(["House", "Senate", "Presidential"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setChamber(value)}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold ${
                  chamber === value
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                {value === "Presidential" ? "President" : value}
              </button>
            ))}
          </div>
          <div className="space-y-7 px-5 py-5 sm:px-7">
            <section>
              <div className="mb-3 flex items-baseline justify-between border-b pb-2">
                <h3 className="font-serif text-2xl font-bold">Current bills</h3>
                <span className="font-mono text-xs text-muted-foreground">
                  {chamberData.bills.length} active
                </span>
              </div>
              <div className="divide-y border-b">
                {chamberData.bills.map((bill) => (
                  <div key={bill.id} className="space-y-3 px-2 py-4 sm:px-3">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row">
                      <div>
                        <Link
                          to="/dashboard/bills/$billId"
                          params={{ billId: String(bill.id) }}
                          className="font-serif text-xl font-bold hover:text-primary"
                          onClick={() => setOpen(false)}
                        >
                          Bill #{bill.id}: {bill.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Proposed by {bill.creator ?? "Unknown"}
                        </p>
                      </div>
                      <VoteResult yes={bill.votes.yes} no={bill.votes.no} />
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {bill.content}
                    </p>
                    <Link
                      to="/dashboard/bills/$billId"
                      params={{ billId: String(bill.id) }}
                      className="inline-block text-xs font-semibold text-primary hover:underline"
                      onClick={() => setOpen(false)}
                    >
                      Review the locked Senate Committee outcome before voting
                    </Link>
                    {eligible && !voted[bill.id] && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={submitting === bill.id}
                          onClick={() =>
                            setPendingVote({
                              billId: bill.id,
                              title: bill.title,
                              voteYes: true,
                            })
                          }
                        >
                          {chamber === "Presidential" ? "Sign" : "Vote for"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={submitting === bill.id}
                          onClick={() =>
                            setPendingVote({
                              billId: bill.id,
                              title: bill.title,
                              voteYes: false,
                            })
                          }
                        >
                          {chamber === "Presidential" ? "Veto" : "Vote against"}
                        </Button>
                      </div>
                    )}
                    {eligible && voted[bill.id] && (
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        Your decision is recorded.
                      </p>
                    )}
                  </div>
                ))}
                {!chamberData.bills.length && (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No bill is currently before this chamber.
                  </p>
                )}
              </div>
              {!eligible && user && (
                <p className="mt-3 text-xs text-muted-foreground">
                  The {role} office votes at this desk. Your current office is{" "}
                  {user.role ?? "Citizen"}.
                </p>
              )}
              {error && (
                <p className="mt-3 text-sm text-destructive">{error}</p>
              )}
            </section>
            {chamber !== "Presidential" && (
              <CompositionGraph
                chamber={chamber}
                members={chamberData.members}
              />
            )}
            <section>
              <div className="mb-3 flex items-baseline justify-between border-b pb-2">
                <h3 className="font-serif text-2xl font-bold">
                  Serving roster
                </h3>
                <span className="font-mono text-xs text-muted-foreground">
                  {chamberData.members.length} members
                </span>
              </div>
              <div className="grid gap-px overflow-hidden border bg-border sm:grid-cols-2 lg:grid-cols-3">
                {chamberData.members.map((member) => (
                  <Link
                    key={member.id}
                    to="/dashboard/players/$playerId"
                    params={{ playerId: String(member.id) }}
                    className="flex items-center justify-between gap-3 bg-card px-3 py-3 hover:bg-muted/50"
                    onClick={() => setOpen(false)}
                  >
                     <span className="flex min-w-0 items-center gap-2">
                       <PlayerAvatar username={member.username} photoUrl={member.photoUrl} className="size-9" />
                       <span className="truncate font-semibold">{member.username}</span>
                     </span>
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: member.partyColor ?? "#64748b",
                        }}
                      />
                      <span className="truncate">
                        {member.partyName ?? "Independent"}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
      <MessageDialog
        open={Boolean(pendingVote)}
        onOpenChange={(value) => {
          if (!value) setPendingVote(null);
        }}
        title="Confirm your decision"
        description={`This will record your final ${pendingVote?.voteYes ? (chamber === "Presidential" ? "signature" : "vote for") : chamber === "Presidential" ? "veto" : "vote against"} Bill #${pendingVote?.billId}: ${pendingVote?.title ?? ""}.`}
        confirmText={
          pendingVote?.voteYes
            ? chamber === "Presidential"
              ? "Sign bill"
              : "Vote for"
            : chamber === "Presidential"
              ? "Veto bill"
              : "Vote against"
        }
        cancelText="Cancel"
        variant={pendingVote?.voteYes ? "default" : "destructive"}
        onConfirm={async () => {
          if (pendingVote) {
            await castVote(pendingVote.billId, pendingVote.voteYes);
            setPendingVote(null);
          }
        }}
      />
    </>
  );
}

function CompositionGraph({
  chamber,
  members,
}: {
  chamber: "House" | "Senate";
  members: Array<DeskMember>;
}) {
  const groups = members.reduce<
    Array<{ name: string; color: string; count: number }>
  >((current, member) => {
    const name = member.partyName ?? "Independent";
    const color = member.partyColor ?? "#64748b";
    const existing = current.find((group) => group.name === name);
    if (existing) {
      existing.count += 1;
    } else {
      current.push({ name, color, count: 1 });
    }
    return current;
  }, []);
  groups.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const total = members.length;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between border-b pb-2">
        <h3 className="font-serif text-2xl font-bold">{chamber} composition</h3>
        <span className="font-mono text-xs text-muted-foreground">
          {total} seats
        </span>
      </div>
      {total ? (
        <div className="space-y-4">
          <PartyCompositionBar
            groups={groups}
            label={`${chamber} composition`}
          />
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {groups.map((group) => {
              const percentage = Math.round((group.count / total) * 100);
              return (
                <div key={group.name} className="min-w-0">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="truncate">{group.name}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {group.count} · {percentage}%
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden bg-muted">
                    <div
                      className="h-full"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: group.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          No seats are currently filled.
        </p>
      )}
    </section>
  );
}

function VoteResult({ yes, no }: { yes: number; no: number }) {
  const total = yes + no;
  return (
    <div className="w-full shrink-0 sm:w-52">
      <div className="mb-1 flex justify-between font-mono text-xs">
        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> {yes} for
        </span>
        <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
          <XCircle className="h-3.5 w-3.5" /> {no} against
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden bg-muted">
        <div
          className="bg-emerald-600"
          style={{ width: `${(yes / (total || 1)) * 100}%` }}
        />
        <div
          className="bg-red-600"
          style={{ width: `${(no / (total || 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}
