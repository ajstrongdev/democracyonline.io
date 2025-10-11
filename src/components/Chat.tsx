/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

interface Chat {
  id: number;
  username: string;
  created_at: string;
  message: string;
}

interface ChatProps {
  room: string;
  userId: number;
  username: string;
  title?: string;
}

export function Chat({ room, userId, username, title = "Chat" }: ChatProps) {
  const queryClient = useQueryClient();

  const getChats = useQuery({
    queryKey: ["chats", room],
    queryFn: async () => {
      const response = await axios.post("/api/get-chats", {
        room,
      });
      return response.data.chats;
    },
    enabled: !!room,
    refetchInterval: 10000, // Refresh every 10 secs
  });

  const addChat = useMutation({
    mutationFn: async (message: string) => {
      const res = await axios.post("/api/chats-add", {
        user_id: userId,
        room,
        username,
        message,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats", room] });
    },
  });

  return (
    <Card className="my-4">
      <CardTitle className="px-4 text-lg font-medium text-foreground">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <Card className="bg-border my-4">
          <CardContent className="space-y-4 max-h-96 overflow-y-auto scrollbar-thin">
            {getChats.isLoading ? (
              <p className="text-muted-foreground">Loading messages...</p>
            ) : getChats.data && getChats.data.length > 0 ? (
              [...getChats.data].reverse().map((chat: any) => (
                <div key={chat.id} className="p-2 border-b last:border-0">
                  <p className="text-sm">
                    <span className="font-medium text-foreground">
                      {chat.username}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      ({new Date(chat.created_at).toLocaleString()}):
                    </span>
                  </p>
                  <p className="text-foreground">{chat.message}</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">
                No messages yet. Start the conversation!
              </p>
            )}
          </CardContent>
        </Card>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const input = form.elements.namedItem(
              "message"
            ) as HTMLInputElement;
            if (input.value.trim() === "") return;
            addChat.mutate(input.value);
            input.value = "";
          }}
        >
          <div className="md:flex gap-2">
            <input
              type="text"
              name="message"
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <Button
              type="submit"
              className="h-auto w-full md:w-auto mt-4 md:mt-0"
              disabled={addChat.isPending}
            >
              {addChat.isPending ? "Sending..." : "Send"}
            </Button>
          </div>
        </form>
      </CardTitle>
    </Card>
  );
}
