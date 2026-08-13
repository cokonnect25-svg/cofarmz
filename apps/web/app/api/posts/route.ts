import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function ensureSchema() {
  await sql`CREATE TABLE IF NOT EXISTS profile_posts (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    audience VARCHAR(20) NOT NULL DEFAULT 'everyone',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS profile_posts_user_created_idx ON profile_posts(user_id, created_at DESC)`;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const viewerId = params.get('viewerId');
  const userId = params.get('userId');
  try {
    await ensureSchema();
    let viewerRole = '';
    if (viewerId) {
      const viewer = await sql`SELECT LOWER(COALESCE(role, '')) AS role, role_id FROM "user" WHERE id = ${viewerId} LIMIT 1`;
      viewerRole = viewer[0]?.role || (Number(viewer[0]?.role_id) === 1 ? 'farmer' : Number(viewer[0]?.role_id) === 2 ? 'buyer' : '');
    }
    const posts = await sql`
      SELECT p.id, p.user_id, p.content, p.image_url, p.audience, p.created_at, p.updated_at,
             u.name AS author_name, u.image AS author_image, u.location AS author_location,
             LOWER(COALESCE(u.role, '')) AS author_role
      FROM profile_posts p
      JOIN "user" u ON u.id = p.user_id
      WHERE (${userId || ''} = '' OR p.user_id = ${userId || ''})
        AND (p.audience = 'everyone' OR p.audience = ${viewerRole} OR p.user_id = ${viewerId || ''})
      ORDER BY p.created_at DESC
      LIMIT 50
    `;
    return NextResponse.json(posts);
  } catch (error: any) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = String(body.user_id || '').trim();
    const content = String(body.content || '').trim();
    const audience = ['everyone', 'farmer', 'buyer'].includes(body.audience) ? body.audience : 'everyone';
    if (!userId || !content) return NextResponse.json({ error: 'User and post text are required' }, { status: 400 });
    if (content.length > 3000) return NextResponse.json({ error: 'Post text must be 3000 characters or less' }, { status: 400 });
    await ensureSchema();
    const result = await sql`INSERT INTO profile_posts (user_id, content, image_url, audience) VALUES (${userId}, ${content}, ${body.image_url || null}, ${audience}) RETURNING *`;
    return NextResponse.json(result[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create post' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = Number(params.get('id'));
  const userId = params.get('userId');
  if (!Number.isInteger(id) || !userId) return NextResponse.json({ error: 'Post and user are required' }, { status: 400 });
  try {
    await ensureSchema();
    const deleted = await sql`DELETE FROM profile_posts WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
    if (!deleted.length) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete post' }, { status: 500 });
  }
}
