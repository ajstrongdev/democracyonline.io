export function mentionPushPayload({
  sourceType,
  sourceId,
  postId,
  content,
  preview,
}: {
  sourceType: "post" | "comment";
  sourceId: number;
  postId: number;
  content: string;
  preview: boolean;
}) {
  return JSON.stringify({
    title: "Oscana mention",
    body: preview ? content.slice(0, 100) : "You have a new mention on Z.com.",
    url: `/dashboard/social?postId=${postId}${sourceType === "comment" ? `&commentId=${sourceId}` : ""}`,
    tag: `mention:${sourceType}:${sourceId}`,
  });
}

export function nextMovePushPayload({ key, title, url, preview }: {
  key: string;
  title: string;
  url: string;
  preview: boolean;
}) {
  return JSON.stringify({
    title: "Your next moves",
    body: preview ? title.slice(0, 100) : "A decision is waiting on your dashboard.",
    url: preview ? url : "/dashboard#next-moves",
    tag: `next-move:${key}`,
  });
}
