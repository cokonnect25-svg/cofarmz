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

    const existing = await sql`
      SELECT id FROM reel_likes WHERE user_id = ${userId} AND reel_id = ${id}
    `;

    if (existing.length > 0) {
      // Unlike
      await sql`
        DELETE FROM reel_likes WHERE user_id = ${userId} AND reel_id = ${id}
      `;
      return NextResponse.json({ liked: false });
    } else {
      // Like
      await sql`
        INSERT INTO reel_likes (user_id, reel_id)
        VALUES (${userId}, ${id})
      `;
      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    console.error("Like error:", error);
    return NextResponse.json(
      { error: "Failed to like reel" },
      { status: 500 }
    );
  }
}
