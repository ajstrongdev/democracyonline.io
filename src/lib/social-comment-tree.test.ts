import { describe, expect, it } from "vitest";
import {
  buildCommentTree,
  countThreadReplies,
} from "@/lib/social-comment-tree";

describe("comment threads", () => {
  it("nests multi-level replies without losing chronological sibling order", () => {
    const tree = buildCommentTree([
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
      { id: 3, parentId: 2 },
      { id: 4, parentId: 1 },
      { id: 5, parentId: null },
    ]);
    expect(tree.map((node) => node.comment.id)).toEqual([1, 5]);
    expect(tree[0].replies.map((node) => node.comment.id)).toEqual([2, 4]);
    expect(tree[0].replies[0].replies[0].comment.id).toBe(3);
    expect(countThreadReplies(tree[0])).toBe(3);
  });

  it("keeps replies whose parent is missing visible", () => {
    expect(buildCommentTree([{ id: 2, parentId: 99 }])[0].comment.id).toBe(2);
  });
});
