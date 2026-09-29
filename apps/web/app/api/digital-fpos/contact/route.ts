import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';
import { requireActor, requireFpoReviewer, fpoError, FpoError } from '@/lib/fpo-access';
export const dynamic = 'force-dynamic';
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const headers = { 'Cache-Control': 'private, no-store' };

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    if (actor.role !== 'farmer') throw new FpoError('Farmer access required', 403);
    const input = await request.json();
    if (!input || typeof input.fpoId !== 'string' || !uuid.test(input.fpoId)) throw new FpoError('Valid FPO required');
    if (typeof input.body !== 'string' || !input.body.trim() || input.body.trim().length > 5000) throw new FpoError('Enter a message of 1 to 5000 characters');
    const [message] = await sql`INSERT INTO fpo_admin_inbox(digital_fpo_id,sender_id,body)
      SELECT f.id,${actor.id},${input.body.trim()} FROM digital_fpos f WHERE f.id=${input.fpoId} AND f.status='active'
      RETURNING id`;
    if (!message) throw new FpoError('This FPO is unavailable', 404);
    return NextResponse.json({ success: true }, { status: 201, headers });
  } catch (e) { return fpoError(e); }
}

export async function GET(request: Request) {
  try {
    await requireFpoReviewer(request);
    const params = new URL(request.url).searchParams;
    const group = params.get('group');
    const offset = Number(params.get('offset') || 0);
    if (!group || !uuid.test(group)) throw new FpoError('Valid group required');
    if (!Number.isSafeInteger(offset) || offset < 0) throw new FpoError('Invalid offset');
    const rows = await sql`SELECT m.id,m.digital_fpo_id,m.body,m.created_at,u.name AS sender_name,m.sender_id
      FROM fpo_admin_inbox m JOIN farmer_groups g ON g.digital_fpo_id=m.digital_fpo_id
      JOIN "user" u ON u.id=m.sender_id WHERE g.id=${group} AND m.recipient_id IS NULL
      ORDER BY m.created_at DESC,m.id DESC LIMIT 51 OFFSET ${offset}`;
    return NextResponse.json({ messages: rows.slice(0,50), next: rows.length > 50 ? offset + 50 : null }, { headers });
  } catch (e) { return fpoError(e); }
}
