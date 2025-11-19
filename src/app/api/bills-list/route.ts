import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const res = await query(`
      SELECT 
        bills.*,
        COALESCE(house_yes.count, 0) AS house_total_yes,
        COALESCE(house_no.count, 0) AS house_total_no,
        COALESCE(senate_yes.count, 0) AS senate_total_yes,
        COALESCE(senate_no.count, 0) AS senate_total_no,
        COALESCE(pres_yes.count, 0) AS presidential_total_yes,
        COALESCE(pres_no.count, 0) AS presidential_total_no
      FROM
        bills
      LEFT JOIN
        (SELECT bill_id, COUNT(*) as count FROM bill_votes_house WHERE vote_yes = TRUE GROUP BY bill_id) house_yes
        ON house_yes.bill_id = bills.id
      LEFT JOIN
        (SELECT bill_id, COUNT(*) as count FROM bill_votes_house WHERE vote_yes = FALSE GROUP BY bill_id) house_no
        ON house_no.bill_id = bills.id
      LEFT JOIN
        (SELECT bill_id, COUNT(*) as count FROM bill_votes_senate WHERE vote_yes = TRUE GROUP BY bill_id) senate_yes
        ON senate_yes.bill_id = bills.id
      LEFT JOIN
        (SELECT bill_id, COUNT(*) as count FROM bill_votes_senate WHERE vote_yes = FALSE GROUP BY bill_id) senate_no
        ON senate_no.bill_id = bills.id
      LEFT JOIN
        (SELECT bill_id, COUNT(*) as count FROM bill_votes_presidential WHERE vote_yes = TRUE GROUP BY bill_id) pres_yes
        ON pres_yes.bill_id = bills.id
      LEFT JOIN
        (SELECT bill_id, COUNT(*) as count FROM bill_votes_presidential WHERE vote_yes = FALSE GROUP BY bill_id) pres_no
        ON pres_no.bill_id = bills.id
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
