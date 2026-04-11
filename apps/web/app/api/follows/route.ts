import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { followingId } = await request.json();
    const userId = request.headers.get("x-user-id");

    if (!userId || !followingId) {
      return NextResponse.json(
        { error: "Missing userId or followingId" },
        { status: 400 }
      );
    }

    // Check if already following
    const existing = await sql`
      SELECT id FROM follows WHERE user_id = ${userId} AND following_id = ${followingId}
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Already following" },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO follows (user_id, following_id)
      VALUES (${userId}, ${followingId})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Follow error:", error);
    return NextResponse.json(
      { error: "Failed to follow user" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { followingId } = await request.json();
    const userId = request.headers.get("x-user-id");

    if (!userId || !followingId) {
      return NextResponse.json(
        { error: "Missing userId or followingId" },
        { status: 400 }
      );
    }

    await sql`
      DELETE FROM follows WHERE user_id = ${userId} AND following_id = ${followingId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unfollow error:", error);
    return NextResponse.json(
      { error: "Failed to unfollow user" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("farmerId") || searchParams.get("user_id");
    const type = searchParams.get("type");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId or farmerId" },
        { status: 400 }
      );
    }

    // If type is specified, return only that type
    if (type === "followers") {
      const followers = await sql`
        SELECT u.id, u.name, u.image FROM follows f
        JOIN "user" u ON f.user_id = u.id
        WHERE f.following_id = ${userId}
        ORDER BY f.created_at DESC
      `;
      return NextResponse.json(followers);
    } else if (type === "following") {
      const following = await sql`
        SELECT u.id, u.name, u.image FROM follows f
        JOIN "user" u ON f.following_id = u.id
        WHERE f.user_id = ${userId}
        ORDER BY f.created_at DESC
      `;
      return NextResponse.json(following);
    }

    // If type is 'both', return counts
    if (type === "both") {
      const followersCountResult = await sql`
        SELECT COUNT(*) as count FROM follows
        WHERE following_id = ${userId}
      `;

      const followingCountResult = await sql`
        SELECT COUNT(*) as count FROM follows
        WHERE user_id = ${userId}
      `;

      const followersCount = followersCountResult && followersCountResult.length > 0 
        ? parseInt(followersCountResult[0].count || 0) 
        : 0;
      
      const followingCount = followingCountResult && followingCountResult.length > 0 
        ? parseInt(followingCountResult[0].count || 0) 
        : 0;

      return NextResponse.json({
        followers_count: followersCount,
        following_count: followingCount
      });
    }

    // If no type specified, return both arrays
    const followers = await sql`
      SELECT u.id, u.name, u.image FROM follows f
      JOIN "user" u ON f.user_id = u.id
      WHERE f.following_id = ${userId}
      ORDER BY f.created_at DESC
    `;

    const following = await sql`
      SELECT u.id, u.name, u.image FROM follows f
      JOIN "user" u ON f.following_id = u.id
      WHERE f.user_id = ${userId}
      ORDER BY f.created_at DESC
    `;

    return NextResponse.json({ followers, following });
  } catch (error) {
    console.error("Get follows error:", error);
    return NextResponse.json(
      { error: "Failed to get follows" },
      { status: 500 }
    );
  }
}
