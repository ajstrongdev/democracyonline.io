"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import withAuth from "@/lib/withAuth";

function Bills() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const addFeed = trpc.feed.add.useMutation();

  const createBill = trpc.bill.create.useMutation({
    onSuccess: (bill) => {
      toast.success("Bill created successfully!");
      utils.bill.listAll.invalidate();
      addFeed.mutate({
        content: `Created a new bill: "Bill #${bill.id}: ${title}"`,
      });
      router.push("/bills");
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to create bill.");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required.");
      return;
    }
    setLoading(true);
    await createBill.mutateAsync({ title, content });
    setLoading(false);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Draft a new bill
        </h1>
        <p className="text-muted-foreground">
          Create a new bill to to voted upon by the House, Senate, and
          President.
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
                  {loading ? "Submitting..." : "Create Bill"}
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

export default withAuth(Bills);
