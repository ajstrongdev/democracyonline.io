"use client";

import React from "react";
import withAuth from "@/lib/withAuth";
import { useQuery } from "@tanstack/react-query";
import GenericSkeleton from "@/components/genericskeleton";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      const response = await axios.post(`/api/get-user-by-id`, { userId });
      return response.data.username;
    } catch (error) {
      return "Unknown User";
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Notifications & Feed
        </h1>
        <p className="text-muted-foreground">
          View the latest updates, and your notifications here.
        </p>
      </div>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground mb-4 border-b pb-2">
          Global Feed
        </h1>
        {loading
          ? Array.from({ length: 5 }).map((_, index) => (
              <GenericSkeleton key={index} />
            ))
          : feed.map((item: FeedItem) => (
              <Card key={item.id} className="p-4">
                <CardContent className="p-0">
                  <div className="flex justify-between items-center w-full">
                    <p className="truncate">
                      <b>{item.username || "Unknown User"}</b>: {item.content}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
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
