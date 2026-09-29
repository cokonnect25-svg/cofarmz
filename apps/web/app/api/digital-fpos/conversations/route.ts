import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';
import { requireActor, canReviewFpos, fpoError, FpoError } from '@/lib/fpo-access';
export const dynamic = 'force-dynamic';
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const reviewer = canReviewFpos(actor.role);
    if (actor.role !== 'farmer' && !reviewer) throw new FpoError('Access denied',403);
    const params = new URL(request.url).searchParams;
    const fpoId = params.get('fpoId');
    const offset = Number(params.get('offset') || 0);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new FpoError('Invalid offset');
    // Farmers cannot select another farmer's conversation.
    const farmerId = reviewer ? params.get('farmerId') : actor.id;
    if (fpoId) {
      if (!uuid.test(fpoId) || !farmerId) throw new FpoError('Valid conversation required');
      const [thread] = await sql`SELECT f.id,f.name,f.status,u.name AS farmer_name FROM digital_fpos f
        JOIN "user" u ON u.id=${farmerId} WHERE f.id=${fpoId}
        AND EXISTS(SELECT 1 FROM fpo_admin_inbox m WHERE m.digital_fpo_id=f.id AND m.sender_id=${farmerId} AND m.recipient_id IS NULL)`;
      if (!thread) throw new FpoError('Conversation not found',404);
      const rows = await sql`SELECT id,body,created_at,recipient_id IS NOT NULL AS from_fpo FROM fpo_admin_inbox
        WHERE digital_fpo_id=${fpoId} AND COALESCE(recipient_id,sender_id)=${farmerId}
        ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET ${offset}`;
      return NextResponse.json({ thread, messages: rows.slice(0,50), next: rows.length > 50 ? offset+50 : null },{headers});
    }
    const rows = await sql`SELECT * FROM (
      SELECT DISTINCT ON (m.digital_fpo_id,COALESCE(m.recipient_id,m.sender_id))
        m.digital_fpo_id AS fpo_id,COALESCE(m.recipient_id,m.sender_id) AS farmer_id,
        f.name,u.name AS farmer_name,m.body,m.created_at,m.recipient_id IS NOT NULL AS from_fpo
      FROM fpo_admin_inbox m JOIN digital_fpos f ON f.id=m.digital_fpo_id
      JOIN "user" u ON u.id=COALESCE(m.recipient_id,m.sender_id)
      WHERE (${reviewer} OR COALESCE(m.recipient_id,m.sender_id)=${actor.id})
      ORDER BY m.digital_fpo_id,COALESCE(m.recipient_id,m.sender_id),m.created_at DESC,m.id DESC
    ) threads ORDER BY created_at DESC,fpo_id,farmer_id LIMIT 51 OFFSET ${offset}`;
    return NextResponse.json({ threads: rows.slice(0,50), next: rows.length > 50 ? offset+50 : null },{headers});
  } catch(e) { return fpoError(e); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    if (!canReviewFpos(actor.role)) throw new FpoError('Admin access required',403);
    const input = await request.json();
    if (!input || typeof input.fpoId !== 'string' || !uuid.test(input.fpoId) || typeof input.farmerId !== 'string' || !input.farmerId) throw new FpoError('Valid conversation required');
    if (typeof input.body !== 'string' || !input.body.trim() || input.body.trim().length > 5000) throw new FpoError('Enter a message of 1 to 5000 characters');
    const [message] = await sql`INSERT INTO fpo_admin_inbox(digital_fpo_id,sender_id,recipient_id,body)
      SELECT f.id,${actor.id},${input.farmerId},${input.body.trim()} FROM digital_fpos f
      WHERE f.id=${input.fpoId} AND f.status='active' AND EXISTS(
        SELECT 1 FROM fpo_admin_inbox m WHERE m.digital_fpo_id=f.id AND m.sender_id=${input.farmerId} AND m.recipient_id IS NULL)
      RETURNING id`;
    if (!message) throw new FpoError('Conversation unavailable',404);
    return NextResponse.json({success:true},{status:201,headers});
  } catch(e) { return fpoError(e); }
}
