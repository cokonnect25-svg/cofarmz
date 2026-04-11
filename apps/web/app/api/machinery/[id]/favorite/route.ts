import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if already favorited
    const existing = await sql`
      SELECT id FROM favorites WHERE user_id = ${userId} AND machinery_id = ${id}
    `;

    if (existing.length > 0) {
      // Remove from favorites (unlike)
      await sql`
        DELETE FROM favorites WHERE user_id = ${userId} AND machinery_id = ${id}
      `;
      return NextResponse.json({ favorited: false });
    } else {
      // Add to favorites (like)
      await sql`
        INSERT INTO favorites (user_id, machinery_id)
        VALUES (${userId}, ${id})
      `;
      return NextResponse.json({ favorited: true });
    }
  } catch (error) {
    console.error("Favorite error:", error);
    return NextResponse.json(
      { error: "Failed to update favorite" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ is_favorited: false });
    }

    const result = await sql`
      SELECT id FROM favorites WHERE user_id = ${userId} AND machinery_id = ${id}
    `;

    return NextResponse.json({ is_favorited: result.length > 0 });
  } catch (error) {
    console.error("Error checking favorite:", error);
    return NextResponse.json(
      { error: "Failed to check favorite status" },
      { status: 500 }
    );
  }
}
