import { expect, it } from "vitest";
import { mentionPushPayload, nextMovePushPayload } from "./push-payload";

it("keeps mention text out of Web Push unless the recipient opted into previews", () => {
  const source = { sourceType: "comment" as const, sourceId: 12, postId: 9, content: "private mention text" };
  const hidden = mentionPushPayload({ ...source, preview: false });
  expect(hidden).not.toContain(source.content);
  expect(JSON.parse(hidden)).toMatchObject({
    url: "/dashboard/social?postId=9&commentId=12",
    tag: "mention:comment:12",
  });
  expect(mentionPushPayload({ ...source, preview: true })).toContain(source.content);
});

it("keeps next-move details private by default", () => {
  const move = { key: "bill:42:House:vote", title: "Vote on a sensitive bill", url: "/dashboard/bills/42" };
  const hidden = nextMovePushPayload({ ...move, preview: false });
  expect(hidden).not.toContain(move.title);
  expect(JSON.parse(hidden).url).toBe("/dashboard#next-moves");
  expect(nextMovePushPayload({ ...move, preview: true })).toContain(move.title);
});
