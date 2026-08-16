import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  const { userId } = await request.json();
  if (!Number.isInteger(postId) || !userId) return NextResponse.json({ error: 'Post and user are required' }, { status: 400 });
  const existing = await sql`SELECT 1 FROM profile_post_likes WHERE post_id = ${postId} AND user_id = ${String(userId)} LIMIT 1`;
  if (existing.length) await sql`DELETE FROM profile_post_likes WHERE post_id = ${postId} AND user_id = ${String(userId)}`;
  else await sql`INSERT INTO profile_post_likes (post_id, user_id) VALUES (${postId}, ${String(userId)})`;
  const count = await sql`SELECT COUNT(*)::int AS count FROM profile_post_likes WHERE post_id = ${postId}`;
  return NextResponse.json({ liked: !existing.length, likes: count[0]?.count || 0 });
}
