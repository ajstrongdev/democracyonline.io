export type CommentNode<T> = {
  comment: T;
  replies: Array<CommentNode<T>>;
};

export function buildCommentTree<
  T extends { id: number; parentId: number | null },
>(comments: Array<T>): Array<CommentNode<T>> {
  const nodes = new Map(
    comments.map((comment) => [
      comment.id,
      { comment, replies: [] as Array<CommentNode<T>> },
    ]),
  );
  const roots: Array<CommentNode<T>> = [];

  for (const node of nodes.values()) {
    const parent =
      node.comment.parentId === null ? null : nodes.get(node.comment.parentId);
    if (parent && parent !== node) parent.replies.push(node);
    else roots.push(node);
  }

  return roots;
}

export function countThreadReplies<T>(node: CommentNode<T>): number {
  return node.replies.reduce(
    (total, reply) => total + 1 + countThreadReplies(reply),
    0,
  );
}
