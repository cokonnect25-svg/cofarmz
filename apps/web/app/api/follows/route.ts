export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { sendPushToUser } from "@/app/api/utils/push";

export async function POST(request: Request) {
  try {
    const { followingId } = await request.json();
    const userId = request.headers.get("x-user-id");
    if (!userId || !followingId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const existing = await sql`
      SELECT id FROM follows WHERE user_id = ${userId} AND following_id = ${followingId}
    `;
    if (existing.length > 0) {
      return NextResponse.json({ error: "Already following" }, { status: 400 });
    }
    const result = await sql`
      INSERT INTO follows (user_id, following_id, status, updated_at)
      VALUES (${userId}, ${followingId}, 'pending', NOW())
      RETURNING *
    `;
    const requesterRows = await sql`
      SELECT name, image
      FROM "user"
      WHERE id = ${userId}
      LIMIT 1
    `.catch(() => []);
    const requester = requesterRows[0];

    await sendPushToUser(followingId, {
      title: "New Follow Request",
      body: `${requester?.name || "Someone"} wants to follow you`,
      image: requester?.image || undefined,
      url: "/notifications",
      tag: `follow-req-${userId}`,
      data: {
        type: "follow_request",
        followerId: userId,
      },
    });

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Follow error:", error);
    return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { followerId, action } = await request.json();
    const userId = request.headers.get("x-user-id");
    if (!userId || !followerId || !['accepted', 'rejected'].includes(action)) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (action === 'rejected') {
      await sql`
        DELETE FROM follows WHERE user_id = ${followerId} AND following_id = ${userId}
      `;
      return NextResponse.json({ success: true, action: 'rejected' });
    }
    const result = await sql`
      UPDATE follows
      SET status = 'accepted', updated_at = NOW()
      WHERE user_id = ${followerId} AND following_id = ${userId}
      RETURNING *
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: "Follow request not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, action: 'accepted' });
  } catch (error) {
    console.error("Follow PATCH error:", error);
    return NextResponse.json({ error: "Failed to update follow" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { followingId } = await request.json();
    const userId = request.headers.get("x-user-id");
    if (!userId || !followingId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    await sql`DELETE FROM follows WHERE user_id = ${userId} AND following_id = ${followingId}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to unfollow" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("farmerId") || searchParams.get("user_id");
    const followingId = searchParams.get("following_id") || searchParams.get("followingId");
    const type = searchParams.get("type");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    if (type === "status") {
      if (!followingId) {
        return NextResponse.json({ error: "Missing followingId" }, { status: 400 });
      }
      const rows = await sql`
        SELECT status FROM follows
        WHERE user_id = ${userId} AND following_id = ${followingId}
        LIMIT 1
      `;
      const status = rows?.[0]?.status === 'accepted' || rows?.[0]?.status === 'pending' ? rows[0].status : 'none';
      return NextResponse.json({ status, isFollowing: status === 'accepted' });
    }

    if (type === "pending_requests") {
      // People who want to follow userId but haven't been accepted yet
      const requests = await sql`
        SELECT f.id, f.user_id, f.created_at, u.name, u.image, u.location, u.role
        FROM follows f
        JOIN "user" u ON u.id = f.user_id
        WHERE f.following_id = ${userId} AND f.status = 'pending'
        ORDER BY f.created_at DESC
      `;
      return NextResponse.json(requests);
    }

    if (type === "followers") {
      const followers = await sql`
        SELECT u.id, u.name, u.image FROM follows f
        JOIN "user" u ON f.user_id = u.id
        WHERE f.following_id = ${userId} AND f.status = 'accepted'
        ORDER BY f.created_at DESC
      `;
      return NextResponse.json(followers);
    }

    if (type === "following") {
      const following = await sql`
        SELECT u.id, u.name, u.image FROM follows f
        JOIN "user" u ON f.following_id = u.id
        WHERE f.user_id = ${userId} AND f.status = 'accepted'
        ORDER BY f.created_at DESC
      `;
      return NextResponse.json(following);
    }

    if (type === "both") {
      const followersCount = await sql`
        SELECT COUNT(*)::int as count FROM follows
        WHERE following_id = ${userId} AND status = 'accepted'
      `;
      const followingCount = await sql`
        SELECT COUNT(*)::int as count FROM follows
        WHERE user_id = ${userId} AND status = 'accepted'
      `;
      const pendingCount = await sql`
        SELECT COUNT(*)::int as count FROM follows
        WHERE following_id = ${userId} AND status = 'pending'
      `;
      return NextResponse.json({
        followers_count: followersCount[0]?.count ?? 0,
        following_count: followingCount[0]?.count ?? 0,
        pending_count: pendingCount[0]?.count ?? 0,
      });
    }

    const followers = await sql`
      SELECT u.id, u.name, u.image FROM follows f
      JOIN "user" u ON f.user_id = u.id
      WHERE f.following_id = ${userId} AND f.status = 'accepted'
      ORDER BY f.created_at DESC
    `;
    const following = await sql`
      SELECT u.id, u.name, u.image FROM follows f
      JOIN "user" u ON f.following_id = u.id
      WHERE f.user_id = ${userId} AND f.status = 'accepted'
      ORDER BY f.created_at DESC
    `;
    return NextResponse.json({ followers, following });
  } catch (error) {
    console.error("Get follows error:", error);
    return NextResponse.json({ error: "Failed to get follows" }, { status: 500 });
  }
}
