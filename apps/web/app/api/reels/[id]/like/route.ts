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
    
    // First check if reel exists
    const reelCheck = await sql`SELECT id FROM reels WHERE id = ${id}`;
    console.log("Reel exists:", reelCheck.length > 0);
    
    // Check likes count (no join)
    const rawLikes = await sql`SELECT user_id FROM reel_likes WHERE reel_id = ${id}`;
    console.log("Raw likes found:", rawLikes.length, rawLikes);
    
    // Now do the join
    const likers = await sql`
      SELECT u.id, u.name, u.image, l.created_at as liked_at
      FROM reel_likes l
      JOIN users u ON u.id = l.user_id
      WHERE l.reel_id = ${id}
      ORDER BY l.created_at DESC
      LIMIT 50
    `;
    
    console.log("Likers after join:", likers.length, likers);
    
    return NextResponse.json({ likers, debug: { rawCount: rawLikes.length } });
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