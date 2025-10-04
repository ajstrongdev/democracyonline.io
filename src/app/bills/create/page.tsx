"use client";

import React, { useState } from "react";
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
import { useRouter } from "next/navigation";

function Bills() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [user] = useAuthState(auth);

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
      const res = await axios.post("/api/bills-create", {
        title,
        content,
        creator_id: userInfo.id,
      });
      axios.post("/api/feed-add", {
        userId: userInfo.id,
        content: `Created a new bill: "Bill #${res.data.id}: ${title}"`,
      });
      toast.success("Bill created successfully!");
      setTitle("");
      setContent("");
      router.push("/bills");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to create bill.");
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-3xl font-bold text-foreground mb-4 border-b pb-2">
          New Bill Form
        </h1>
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
