export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { addSocialNotification, ensureSocialActivityTables, notifyMentions } from '@/app/api/utils/social-notifications';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await ensureSocialActivityTables();
    const viewerId = request.headers.get('x-user-id') || '';

    const comments = await sql`
      SELECT 
        rc.id, rc.user_id, rc.comment, rc.created_at, rc.parent_comment_id,
        u.name, u.image, COUNT(rcl.user_id)::int AS likes,
        BOOL_OR(rcl.user_id = ${viewerId}) AS is_liked
      FROM reel_comments rc
      JOIN "user" u ON rc.user_id = u.id
      LEFT JOIN reel_comment_likes rcl ON rcl.comment_id = rc.id
      WHERE rc.reel_id = ${id}
      GROUP BY rc.id, u.name, u.image
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
    const { comment, parentCommentId } = await request.json();
    const userId = request.headers.get("x-user-id");

    if (!userId || !comment) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await ensureSocialActivityTables();
    const clean = String(comment).trim();
    if (!clean || clean.length > 1000) return NextResponse.json({ error: 'Comment must be 1-1000 characters' }, { status: 400 });
    const reelRows = await sql`SELECT user_id FROM reels WHERE id = ${id} LIMIT 1`;
    const parentRows = parentCommentId
      ? await sql`SELECT user_id FROM reel_comments WHERE id = ${Number(parentCommentId)} AND reel_id = ${id} LIMIT 1`
      : [];
    if (parentCommentId && !parentRows.length) return NextResponse.json({ error: 'Reply target not found' }, { status: 404 });
    const result = await sql`
      INSERT INTO reel_comments (user_id, reel_id, comment, parent_comment_id)
      VALUES (${userId}, ${id}, ${clean}, ${parentCommentId ? Number(parentCommentId) : null})
      RETURNING id, user_id, comment, created_at, parent_comment_id
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
      image: userInfo[0]?.image || null, likes: 0, is_liked: false
    };

    const primaryRecipient = parentRows[0]?.user_id || reelRows[0]?.user_id;
    await addSocialNotification({ recipientId: primaryRecipient, actorId: userId,
      type: parentCommentId ? 'reel_reply' : 'reel_comment', reelId: id,
      commentId: result[0].id, preview: clean });
    await notifyMentions({ text: clean, actorId: userId, type: 'reel_mention', reelId: id,
      commentId: result[0].id, exclude: [String(primaryRecipient || '')] });

    return NextResponse.json(commentWithUser, { status: 201 });
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
