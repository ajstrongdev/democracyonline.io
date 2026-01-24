export type FeedItem = {
  id: number;
  userId: number | null;
  username: string | null;
  content: string;
  createdAt: Date | null;
};
