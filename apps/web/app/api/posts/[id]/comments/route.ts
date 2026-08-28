import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';
import { addSocialNotification, ensureSocialActivityTables, notifyMentions } from '@/app/api/utils/social-notifications';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSocialActivityTables();
  const viewerId = request.headers.get('x-user-id') || '';
  const comments = await sql`SELECT c.id, c.user_id, c.comment, c.created_at, c.parent_comment_id, u.name, u.image,
    COUNT(cl.user_id)::int likes, BOOL_OR(cl.user_id=${viewerId}) is_liked
    FROM profile_post_comments c JOIN "user" u ON u.id = c.user_id
    LEFT JOIN profile_post_comment_likes cl ON cl.comment_id=c.id
    WHERE c.post_id = ${Number(id)} GROUP BY c.id,u.name,u.image ORDER BY c.created_at ASC`;
  return NextResponse.json(comments);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, comment, parentCommentId } = await request.json();
  const clean = String(comment || '').trim();
  if (!userId || !clean) return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
  if (clean.length > 1000) return NextResponse.json({ error: 'Comment is too long' }, { status: 400 });
  await ensureSocialActivityTables();
  const parent = parentCommentId ? await sql`SELECT user_id FROM profile_post_comments WHERE id=${Number(parentCommentId)} AND post_id=${Number(id)} LIMIT 1` : [];
  if (parentCommentId && !parent.length) return NextResponse.json({ error: 'Reply target not found' }, { status: 404 });
  const inserted = await sql`INSERT INTO profile_post_comments (post_id, user_id, comment, parent_comment_id) VALUES (${Number(id)}, ${String(userId)}, ${clean}, ${parentCommentId ? Number(parentCommentId) : null}) RETURNING id, user_id, comment, created_at, parent_comment_id`;
  const users = await sql`SELECT name, image FROM "user" WHERE id = ${String(userId)} LIMIT 1`;
  const owners = await sql`SELECT user_id FROM profile_posts WHERE id=${Number(id)} LIMIT 1`;
  const recipient = parent[0]?.user_id || owners[0]?.user_id;
  await addSocialNotification({ recipientId: recipient, actorId: String(userId), type: parentCommentId ? 'post_reply' : 'post_comment', postId: id, commentId: inserted[0].id, preview: clean });
  await notifyMentions({ text: clean, actorId: String(userId), type: 'post_mention', postId: id, commentId: inserted[0].id, exclude: [String(recipient || '')] });
  return NextResponse.json({ ...inserted[0], ...users[0], likes: 0, is_liked: false }, { status: 201 });
}
