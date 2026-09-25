import { and, eq } from "drizzle-orm";
import type { db } from "@/db";
import { billComments, socialPosts } from "@/db/schema";
import { billCommentPostContent } from "@/lib/bill-comment-post";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function publishBillComment(
  tx: Transaction,
  data: {
    billId: number;
    parentId?: number;
    content: string;
    author: {
      id: number;
      username: string;
      partyName: string | null;
      isPartyLeader: boolean;
    };
  },
) {
  if (data.parentId) {
    const [parent] = await tx
      .select({ id: billComments.id })
      .from(billComments)
      .where(
        and(
          eq(billComments.id, data.parentId),
          eq(billComments.billId, data.billId),
        ),
      )
      .limit(1);
    if (!parent) throw new Error("Reply target not found on this bill");
  }

  const [comment] = await tx
    .insert(billComments)
    .values({
      billId: data.billId,
      parentId: data.parentId ?? null,
      userId: data.author.id,
      username: data.author.username,
      partyName: data.author.partyName,
      isPartyLeader: data.author.isPartyLeader,
      content: data.content,
    })
    .returning({ id: billComments.id });
  const [post] = await tx
    .insert(socialPosts)
    .values({
      userId: data.author.id,
      username: data.author.username,
      content: billCommentPostContent(data.billId, data.content),
    })
    .returning({ id: socialPosts.id });
  return { comment, post };
}
