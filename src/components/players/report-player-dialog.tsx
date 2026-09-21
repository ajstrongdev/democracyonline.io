import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { reportPlayer } from "@/lib/server/moderation";

const categories = [
  ["harassment", "Harassment"],
  ["spam", "Spam"],
  ["impersonation", "Impersonation"],
  ["vote_manipulation", "Vote manipulation"],
  ["other", "Other"],
] as const;

export function ReportPlayerDialog({
  playerId,
  username,
}: {
  playerId: number;
  username: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] =
    useState<(typeof categories)[number][0]>("harassment");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await reportPlayer({
        data: { reportedUserId: playerId, category, details },
      });
      toast.success("Report submitted for moderator review");
      setDetails("");
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not submit report",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Flag className="h-4 w-4" /> Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report {username}</DialogTitle>
          <DialogDescription>
            Reports are private and reviewed by moderators. Include specific,
            factual details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-category">Category</Label>
            <select
              id="report-category"
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value as (typeof categories)[number][0],
                )
              }
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {categories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-details">Details</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              minLength={10}
              maxLength={2000}
              rows={5}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={submitting || details.trim().length < 10}
          >
            {submitting ? "Submitting..." : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
