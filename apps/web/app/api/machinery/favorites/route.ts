import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all favorited machinery for the user
    const favorites = await sql`
      SELECT m.* FROM machinery m
      INNER JOIN favorites f ON m.id = f.machinery_id
      WHERE f.user_id = ${userId}
      ORDER BY f.created_at DESC
    `;

    return NextResponse.json({ favorites });
  } catch (error) {
    console.error("Error fetching favorites:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}
