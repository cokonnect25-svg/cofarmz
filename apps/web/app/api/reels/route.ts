export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // Ensure views column exists
    await sql`ALTER TABLE reels ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0`.catch(() => {});

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const currentUserId = searchParams.get("currentUserId");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50); // Max 50 per request

    let reels;

    if (userId) {
      // Get reels for specific user
      if (cursor) {
        reels = await sql`
          SELECT
            r.id, r.user_id, r.video_url, r.caption, r.thumbnail_url, r.created_at,
            u.name, u.image,
            (SELECT COUNT(*)::int FROM reel_likes WHERE reel_id = r.id) as likes,
            (SELECT COUNT(*)::int FROM reel_comments WHERE reel_id = r.id) as comments,
            COALESCE(r.views, 0) as views,
            ${currentUserId ? sql`EXISTS(SELECT 1 FROM reel_likes WHERE reel_id = r.id AND user_id = ${currentUserId})` : sql`false`} as is_liked,
            ${currentUserId ? sql`EXISTS(SELECT 1 FROM follows WHERE user_id = ${currentUserId} AND following_id = r.user_id)` : sql`false`} as is_followed
          FROM reels r
          JOIN "user" u ON r.user_id = u.id
          WHERE r.user_id = ${userId}
            AND r.created_at < ${new Date(cursor)}
          ORDER BY r.created_at DESC
          LIMIT ${limit + 1}
        `;
      } else {
        reels = await sql`
          SELECT
            r.id, r.user_id, r.video_url, r.caption, r.thumbnail_url, r.created_at,
            u.name, u.image,
            (SELECT COUNT(*)::int FROM reel_likes WHERE reel_id = r.id) as likes,
            (SELECT COUNT(*)::int FROM reel_comments WHERE reel_id = r.id) as comments,
            COALESCE(r.views, 0) as views,
            ${currentUserId ? sql`EXISTS(SELECT 1 FROM reel_likes WHERE reel_id = r.id AND user_id = ${currentUserId})` : sql`false`} as is_liked,
            ${currentUserId ? sql`EXISTS(SELECT 1 FROM follows WHERE user_id = ${currentUserId} AND following_id = r.user_id)` : sql`false`} as is_followed
          FROM reels r
          JOIN "user" u ON r.user_id = u.id
          WHERE r.user_id = ${userId}
          ORDER BY r.created_at DESC
          LIMIT ${limit + 1}
        `;
      }
    } else if (currentUserId) {
      // Get ALL reels with followed status
      if (cursor) {
        reels = await sql`
  SELECT 
    r.id, r.user_id, r.video_url, r.caption, r.thumbnail_url, r.created_at,
    u.name, u.image,
    (SELECT COUNT(*)::int FROM reel_likes WHERE reel_id = r.id) as likes,
    (SELECT COUNT(*)::int FROM reel_comments WHERE reel_id = r.id) as comments,
    COALESCE(r.views, 0) as views,
    EXISTS(SELECT 1 FROM reel_likes WHERE reel_id = r.id AND user_id = ${currentUserId}) as is_liked,
    EXISTS(SELECT 1 FROM follows WHERE user_id = ${currentUserId} AND following_id = r.user_id) as is_followed
  FROM reels r
  JOIN "user" u ON r.user_id = u.id
  WHERE r.created_at < ${new Date(cursor)}
  ORDER BY r.created_at DESC
  LIMIT ${limit + 1}
`;
      } else {
        reels = await sql`
  SELECT 
    r.id, r.user_id, r.video_url, r.caption, r.thumbnail_url, r.created_at,
    u.name, u.image,
    (SELECT COUNT(*)::int FROM reel_likes WHERE reel_id = r.id) as likes,
    (SELECT COUNT(*)::int FROM reel_comments WHERE reel_id = r.id) as comments,
    COALESCE(r.views, 0) as views,
    EXISTS(SELECT 1 FROM reel_likes WHERE reel_id = r.id AND user_id = ${currentUserId}) as is_liked,
    EXISTS(SELECT 1 FROM follows WHERE user_id = ${currentUserId} AND following_id = r.user_id) as is_followed
  FROM reels r
  JOIN "user" u ON r.user_id = u.id
  ORDER BY r.created_at DESC
  LIMIT ${limit + 1}
`;
      }
    } else {
      return NextResponse.json(
        { error: "Missing userId or currentUserId" },
        { status: 400 }
      );
    }

    // Handle pagination
    const hasMore = reels.length > limit;
    const resultReels = reels.slice(0, limit);
    const nextCursor = hasMore ? resultReels[resultReels.length - 1]?.created_at : null;

    return NextResponse.json({
      data: resultReels,
      nextCursor,
      hasMore
    });
  } catch (error) {
    console.error("Get reels error:", error);
    return NextResponse.json(
      { error: "Failed to get reels" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { videoUrl, caption, thumbnailUrl } = body;
    const userId = request.headers.get("x-user-id");

    if (!userId || !videoUrl) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await sql`ALTER TABLE reels ADD COLUMN IF NOT EXISTS thumbnail_url TEXT`.catch(() => {});
    await sql`ALTER TABLE reels ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0`.catch(() => {});

    const reelId = `reel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await sql`
      INSERT INTO reels (id, user_id, video_url, caption, thumbnail_url)
      VALUES (${reelId}, ${userId}, ${videoUrl}, ${caption || null}, ${thumbnailUrl || null})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Create reel error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create reel" },
      { status: 500 }
    );
  }
}

