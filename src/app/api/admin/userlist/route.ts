import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    // Get all users from the database
    const result = await query(
      "SELECT id, email, username, role, party_id, created_at FROM users ORDER BY created_at DESC"
    );

    return NextResponse.json({
      users: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users from database" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { filters } = await request.json();

    let queryText =
      "SELECT id, email, username, role, party_id, created_at FROM users";
    const queryParams: string[] = [];

    // Add filters if provided
    if (filters) {
      const conditions: string[] = [];

      if (filters.role) {
        queryParams.push(filters.role);
        conditions.push(`role = $${queryParams.length}`);
      }

      if (filters.party_id) {
        queryParams.push(filters.party_id);
        conditions.push(`party_id = $${queryParams.length}`);
      }

      if (filters.excludeBanned) {
        conditions.push("username NOT LIKE 'Banned User%'");
      }

      if (conditions.length > 0) {
        queryText += " WHERE " + conditions.join(" AND ");
      }
    }

    queryText += " ORDER BY created_at DESC";

    const result = await query(queryText, queryParams);

    return NextResponse.json({
      users: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users from database" },
      { status: 500 }
    );
  }
}
