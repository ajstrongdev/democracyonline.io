export function billCommentPostContent(
  billId: number,
  comment: string,
): string {
  return `In relation to Bill #${billId}:\n\n${comment}`;
}
