import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const res = await query(`
      SELECT 
        bills.*,
        COUNT(CASE WHEN bill_votes_house.vote_yes = TRUE THEN 1 END) AS house_total_yes,
        COUNT(CASE WHEN bill_votes_house.vote_yes = FALSE THEN 1 END) AS house_total_no,
        COUNT(CASE WHEN bill_votes_senate.vote_yes = TRUE THEN 1 END) AS senate_total_yes,
        COUNT(CASE WHEN bill_votes_senate.vote_yes = FALSE THEN 1 END) AS senate_total_no,
        COUNT(CASE WHEN bill_votes_presidential.vote_yes = TRUE THEN 1 END) AS presidential_total_yes,
        COUNT(CASE WHEN bill_votes_presidential.vote_yes = FALSE THEN 1 END) AS presidential_total_no
      FROM
        bills
      LEFT JOIN
        bill_votes_house ON bill_votes_house.bill_id = bills.id
      LEFT JOIN
        bill_votes_senate ON bill_votes_senate.bill_id = bills.id
      LEFT JOIN
        bill_votes_presidential ON bill_votes_presidential.bill_id = bills.id
      GROUP BY
        bills.id
      ORDER BY
        created_at DESC
    `);
    return NextResponse.json({ bills: res.rows }, { status: 200 });
  } catch (error) {
    console.error("Error fetching bills:", error);
    return NextResponse.json(
      { error: "Failed to fetch bills" },
      { status: 500 }
    );
  }
}
