import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const comments = await sql`
      SELECT 
        rc.id, rc.user_id, rc.comment, rc.created_at,
        u.name, u.image
      FROM reel_comments rc
      JOIN "user" u ON rc.user_id = u.id
      WHERE rc.reel_id = ${id}
      ORDER BY rc.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json(
      { error: "Failed to get comments" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { comment } = await request.json();
    const userId = request.headers.get("x-user-id");

    if (!userId || !comment) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Insert comment and return with user info
    const result = await sql`
      INSERT INTO reel_comments (user_id, reel_id, comment)
      VALUES (${userId}, ${id}, ${comment})
      RETURNING id, user_id, comment, created_at
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
    }

    // Get user info
    const userInfo = await sql`
      SELECT id, name, image FROM "user" WHERE id = ${userId}
    `;

    const commentWithUser = {
      ...result[0],
      name: userInfo[0]?.name || "Unknown",
      image: userInfo[0]?.image || null
    };

    return NextResponse.json(commentWithUser, { status: 201 });
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
