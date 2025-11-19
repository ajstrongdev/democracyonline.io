"use client";

import type { TRPCClientError } from "@trpc/client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import GenericSkeleton from "@/components/genericskeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "@/server/routers";

function EditBill() {
  const router = useRouter();
  const params = useParams();
  const utils = trpc.useUtils();
  const billId = params.id as string;
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingBill, setFetchingBill] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: bill, isLoading: billLoading } = trpc.bill.get.useQuery(
    { id: Number(billId) },
    { enabled: !!billId },
  );

  useEffect(() => {
    if (!billId) {
      setError("Bill ID is missing");
      setFetchingBill(false);
      return;
    }
    if (!billLoading && bill) {
      setTitle(bill.title);
      setContent(bill.content);
      setFetchingBill(false);
    }
  }, [billId, billLoading, bill]);

  const addFeed = trpc.feed.add.useMutation();

  const updateBill = trpc.bill.update.useMutation({
    onSuccess: async (b) => {
      toast.success("Bill updated successfully!");
      await utils.bill.get.invalidate({ id: Number(billId) });
      await utils.bill.listAll.invalidate();
      addFeed.mutate({ content: `Updated bill #${b.id}: "${title}"` });
      router.push("/bills");
    },
    onError: (err: TRPCClientError<AppRouter>) =>
      toast.error(err.message || "Failed to update bill."),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required.");
      return;
    }

    setLoading(true);
    await updateBill.mutateAsync({
      id: Number(billId),
      title,
      content,
    });
    setLoading(false);
  };

  if (fetchingBill) {
    return (
      <div className="container mx-auto py-8 px-4">
        <GenericSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent>
            <div className="text-red-500 py-4">{error}</div>
            <Link href="/bills">
              <Button>Back to Bills</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Edit Bill</h1>
        <p className="text-muted-foreground">
          Update your bill before it enters the voting process.
        </p>
      </div>
      <div className="space-y-4">
        <Card>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter bill title"
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Describe the bill in detail"
                  rows={8}
                  required
                  disabled={loading}
                />
              </div>
              <div className="flex gap-4 items-center">
                <Button type="submit" disabled={loading}>
                  {loading ? "Updating..." : "Update Bill"}
                </Button>
                <Link
                  href="/bills"
                  className="text-sm underline text-muted-foreground"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default withAuth(EditBill);
