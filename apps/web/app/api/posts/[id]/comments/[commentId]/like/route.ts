import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';
import { ensureSocialActivityTables } from '@/app/api/utils/social-notifications';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const { id, commentId } = await params; const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureSocialActivityTables();
  const target = await sql`SELECT id FROM profile_post_comments WHERE id=${Number(commentId)} AND post_id=${Number(id)} LIMIT 1`;
  if (!target.length) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  const existing = await sql`SELECT 1 FROM profile_post_comment_likes WHERE comment_id=${Number(commentId)} AND user_id=${String(userId)}`;
  if(existing.length) await sql`DELETE FROM profile_post_comment_likes WHERE comment_id=${Number(commentId)} AND user_id=${String(userId)}`;
  else await sql`INSERT INTO profile_post_comment_likes(comment_id,user_id) VALUES(${Number(commentId)},${String(userId)}) ON CONFLICT DO NOTHING`;
  const count=await sql`SELECT COUNT(*)::int count FROM profile_post_comment_likes WHERE comment_id=${Number(commentId)}`;
  return NextResponse.json({liked:!existing.length,likes:count[0]?.count||0});
}
