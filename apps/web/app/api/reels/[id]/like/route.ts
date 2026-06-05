export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log("Fetching likers for reel:", id);

    // Step 1: Get likes from reel_likes
    const likes = await sql`
      SELECT user_id, created_at as liked_at
      FROM reel_likes
      WHERE reel_id = ${id}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    console.log("Raw likes found:", likes.length);

    if (likes.length === 0) {
      return NextResponse.json({ likers: [] });
    }

    // Step 2: Get user IDs
    const userIds = likes.map((l: any) => l.user_id);
    console.log("User IDs:", userIds);

    // Step 3: Fetch users - MUST quote "user" table name and use sql.unsafe for dynamic identifiers
    // The "user" table is in public schema and must be quoted because "user" is a reserved keyword
    const users = await sql.unsafe(`
      SELECT id, name, image, role, location
      FROM "public"."user"
      WHERE id = ANY($1)
    `, [userIds]);

    console.log("Users found:", users.length);

    // Step 4: Merge manually
    const likers = likes.map((like: any) => {
      const user = users.find((u: any) => u.id === like.user_id);
      return {
        id: like.user_id,
        name: user?.name || 'Unknown User',
        image: user?.image || null,
        role: user?.role || null,
        location: user?.location || null,
        liked_at: like.liked_at
      };
    });

    return NextResponse.json({ likers });
  } catch (error: any) {
    console.error("Error fetching likers:", error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await sql`
      SELECT id FROM reel_likes WHERE user_id = ${userId} AND reel_id = ${id}
    `;

    if (existing.length > 0) {
      await sql`
        DELETE FROM reel_likes WHERE user_id = ${userId} AND reel_id = ${id}
      `;
    } else {
      await sql`
        INSERT INTO reel_likes (user_id, reel_id)
        VALUES (${userId}, ${id})
        ON CONFLICT (user_id, reel_id) DO NOTHING
      `;
    }

    // Always return the real count from DB — single source of truth
    const countResult = await sql`
      SELECT COUNT(*)::int AS count FROM reel_likes WHERE reel_id = ${id}
    `;

    const liked = existing.length === 0; // was not liked → now liked
    const likes = countResult[0]?.count ?? 0;

    return NextResponse.json({ liked, likes });

  } catch (error) {
    console.error("Like error:", error);
    return NextResponse.json({ error: "Failed to like reel" }, { status: 500 });
  }
}