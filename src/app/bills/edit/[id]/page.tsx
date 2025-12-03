"use client";

import React, { useState, useEffect } from "react";
import withAuth from "@/lib/withAuth";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { fetchUserInfo } from "@/app/utils/userHelper";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import GenericSkeleton from "@/components/common/genericskeleton";

function EditBill() {
  const router = useRouter();
  const params = useParams();
  const billId = params.id as string;
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingBill, setFetchingBill] = useState(true);
  const [user] = useAuthState(auth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBill = async () => {
      if (!billId) {
        setError("Bill ID is missing");
        setFetchingBill(false);
        return;
      }

      try {
        const res = await axios.get(`/api/bills-get?id=${billId}`);
        const bill = res.data.bill;

        // Check if user is the creator
        const userInfo = await fetchUserInfo(user?.email || "");
        if (bill.creator_id !== userInfo?.id) {
          toast.error("You can only edit bills you created");
          router.push("/bills");
          return;
        }

        // Check if bill is still in Queued status
        if (bill.status !== "Queued") {
          toast.error("Only bills in 'Queued' status can be edited");
          router.push("/bills");
          return;
        }

        setTitle(bill.title);
        setContent(bill.content);
        setFetchingBill(false);
      } catch (err) {
        console.error("Error fetching bill:", err);
        toast.error("Failed to load bill");
        router.push("/bills");
      }
    };

    if (user) {
      loadBill();
    }
  }, [billId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required.");
      return;
    }
    setLoading(true);
    try {
      const userInfo = await fetchUserInfo(user?.email || "");
      if (!userInfo?.id) {
        toast.error("Could not determine user ID.");
        setLoading(false);
        return;
      }

      // Re-verify bill ownership and status before submitting
      const billCheck = await axios.get(`/api/bills-get?id=${billId}`);
      const bill = billCheck.data.bill;

      if (bill.creator_id !== userInfo.id) {
        toast.error("Unauthorized: You can only edit bills you created");
        router.push("/bills");
        return;
      }

      if (bill.status !== "Queued") {
        toast.error("Cannot edit: Only bills in 'Queued' status can be edited");
        router.push("/bills");
        return;
      }

      const res = await axios.post("/api/bills-update", {
        id: parseInt(billId),
        title,
        content,
        creator_id: userInfo.id,
      });
      await axios.post("/api/feed-add", {
        userId: userInfo.id,
        content: `Updated bill #${res.data.id}: "${title}"`,
      });
      toast.success("Bill updated successfully!");
      router.push("/bills");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to update bill.");
    } finally {
      setLoading(false);
    }
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
