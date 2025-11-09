"use client";

import React from "react";
import withAuth from "@/lib/withAuth";
import { useQuery } from "@tanstack/react-query";
import GenericSkeleton from "@/components/genericskeleton";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";

type FeedItem = {
  id: number;
  user_id: number;
  username?: string;
  content: string;
  created_at: string;
};

function Home() {
  const { data: feed = [], isLoading: loading } = useQuery({
    queryKey: ["feed"],
    queryFn: async () => {
      const response = await axios.get("/api/feed-list");
      const feedWithUsernames = await Promise.all(
        response.data.map(async (item: FeedItem) => {
          const username = await getUserById(item.user_id);
          return { ...item, username };
        })
      );
      return feedWithUsernames;
    },
    staleTime: 0,
  });

  const getUserById = async (userId: number) => {
    try {
      const response = await axios.post(`/api/get-user-without-email`, {
        userId,
      });
      return response.data.username;
    } catch {
      return "Unknown User";
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Feed</h1>
        <p className="text-muted-foreground">
          Stay updated with the latest activities in the community.
        </p>
      </div>
      <div className="space-y-4">
        {loading
          ? Array.from({ length: 5 }).map((_, index) => (
              <GenericSkeleton key={index} />
            ))
          : feed.map((item: FeedItem) => (
              <Card key={item.id} className="p-4">
                <CardContent className="p-0">
                  <div className="md:flex justify-between items-center w-full">
                    <p className="text-wrap">
                      <b>{item.username || "Unknown User"}</b>: {item.content}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap md:ml-4">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}

export default withAuth(Home);
