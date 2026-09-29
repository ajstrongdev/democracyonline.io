import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ReactNode } from "react";
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
import { ReferenceInsert } from "@/components/reference-insert";
import { createBill } from "@/lib/server/bills/bills";
import { dashboardComposeEvent } from "@/lib/dashboard-commands";

export function NewBillDialog({
  userId,
  autoOpen = false,
  trigger,
  dashboardCommand = false,
}: {
  userId: number | null | undefined;
  autoOpen?: boolean;
  trigger?: ReactNode;
  dashboardCommand?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!dashboardCommand) return;
    const openComposer = (event: Event) => {
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener(dashboardComposeEvent.bill, openComposer);
    return () =>
      window.removeEventListener(dashboardComposeEvent.bill, openComposer);
  }, [dashboardCommand]);

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
      toast.success("Bill submitted to the Senate Committee");
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
        {trigger ?? <Button size="sm">Draft a bill</Button>}
      </DialogTrigger>
      <DialogContent className="flex h-dvh max-h-dvh flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-sm">
        <DialogHeader className="shrink-0 border-b px-4 pb-4 pt-3 text-left sm:px-6 sm:pt-6">
          <p className="wiki-kicker">Legislative submission</p>
          <DialogTitle className="font-serif text-3xl">
            Draft a new bill
          </DialogTitle>
          <DialogDescription>
            New proposals enter the Senate Committee before House consideration.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="space-y-2">
            <Label htmlFor="new-bill-title">Title</Label>
            <Input
              id="new-bill-title"
              className="h-11"
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
              className="min-h-56"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={10}
              placeholder="Set out the proposal in detail..."
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
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
