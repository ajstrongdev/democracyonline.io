import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  const { id, title, content, creator_id } = (await request.json()) as {
    id: number;
    title: string;
    content: string;
    creator_id: number;
  };

  if (!id || !title || !content || !creator_id) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  try {
    // First, check if the bill exists and get its current state
    const billCheck = await query(
      "SELECT creator_id, status FROM bills WHERE id = $1",
      [id]
    );

    if (billCheck.rows.length === 0) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    const bill = billCheck.rows[0];

    // Check if the user is the creator
    if (bill.creator_id !== creator_id) {
      return NextResponse.json(
        { error: "Unauthorized: You can only edit bills you created" },
        { status: 403 }
      );
    }

    // Check if the bill is still in Queued status
    if (bill.status !== "Queued") {
      return NextResponse.json(
        {
          error:
            "Cannot edit bill: Only bills in 'Queued' status can be edited",
        },
        { status: 400 }
      );
    }

    // Update the bill
    const result = await query(
      "UPDATE bills SET title = $1, content = $2 WHERE id = $3 RETURNING *",
      [title, content, id]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update bill" },
      { status: 500 }
    );
  }
}
