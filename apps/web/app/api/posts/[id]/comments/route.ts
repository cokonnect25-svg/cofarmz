import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const comments = await sql`SELECT c.id, c.user_id, c.comment, c.created_at, u.name, u.image FROM profile_post_comments c JOIN "user" u ON u.id = c.user_id WHERE c.post_id = ${Number(id)} ORDER BY c.created_at ASC`;
  return NextResponse.json(comments);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, comment } = await request.json();
  const clean = String(comment || '').trim();
  if (!userId || !clean) return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
  if (clean.length > 1000) return NextResponse.json({ error: 'Comment is too long' }, { status: 400 });
  const inserted = await sql`INSERT INTO profile_post_comments (post_id, user_id, comment) VALUES (${Number(id)}, ${String(userId)}, ${clean}) RETURNING id, user_id, comment, created_at`;
  const users = await sql`SELECT name, image FROM "user" WHERE id = ${String(userId)} LIMIT 1`;
  return NextResponse.json({ ...inserted[0], ...users[0] }, { status: 201 });
}
