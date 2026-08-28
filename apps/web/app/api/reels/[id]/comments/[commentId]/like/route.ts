import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import {
  addSocialNotification,
  ensureSocialActivityTables,
} from "@/app/api/utils/social-notifications";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await params;
  const userId = request.headers.get("x-user-id");
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSocialActivityTables();
  const target =
    await sql`SELECT id,user_id,comment FROM reel_comments WHERE id=${Number(
      commentId
    )} AND reel_id=${id} LIMIT 1`;
  if (!target.length)
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  const existing =
    await sql`SELECT 1 FROM reel_comment_likes WHERE comment_id=${Number(
      commentId
    )} AND user_id=${userId}`;
  if (existing.length)
    await sql`DELETE FROM reel_comment_likes WHERE comment_id=${Number(
      commentId
    )} AND user_id=${userId}`;
  else {
    await sql`INSERT INTO reel_comment_likes(comment_id,user_id) VALUES(${Number(
      commentId
    )},${userId}) ON CONFLICT DO NOTHING`;
    await addSocialNotification({
      recipientId: target[0].user_id,
      actorId: userId,
      type: "reel_comment_like",
      reelId: id,
      commentId,
      preview: target[0].comment,
    });
  }
  const count =
    await sql`SELECT COUNT(*)::int count FROM reel_comment_likes WHERE comment_id=${Number(
      commentId
    )}`;
  return NextResponse.json({
    liked: !existing.length,
    likes: count[0]?.count || 0,
  });
}
