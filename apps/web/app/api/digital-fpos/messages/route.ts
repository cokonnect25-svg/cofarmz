import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';
import { requireActor, fpoError } from '@/lib/fpo-access';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const messages = await sql`SELECT a.id,a.title,a.body,a.created_at,a.group_id,r.read_at FROM announcements a
      LEFT JOIN fpo_message_reads r ON r.announcement_id=a.id AND r.farmer_id=${actor.id}
      WHERE a.group_id IS NOT NULL AND can_receive_fpo_message(${actor.id},a.group_id)
      AND (a.expires_at IS NULL OR a.expires_at>now()) AND (a.scheduled_at IS NULL OR a.scheduled_at<=now())
      ORDER BY a.created_at DESC LIMIT 100`;
    const [count] = await sql`SELECT count(*)::int AS unread FROM announcements a WHERE a.group_id IS NOT NULL
      AND can_receive_fpo_message(${actor.id},a.group_id) AND (a.expires_at IS NULL OR a.expires_at>now())
      AND (a.scheduled_at IS NULL OR a.scheduled_at<=now())
      AND NOT EXISTS(SELECT 1 FROM fpo_message_reads r WHERE r.announcement_id=a.id AND r.farmer_id=${actor.id})`;
    return NextResponse.json({ messages, unread:count.unread });
  } catch(e) { return fpoError(e); }
}
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await sql`INSERT INTO fpo_message_reads(farmer_id,announcement_id)
      SELECT ${actor.id},a.id FROM announcements a WHERE a.group_id IS NOT NULL
      AND can_receive_fpo_message(${actor.id},a.group_id) AND (a.scheduled_at IS NULL OR a.scheduled_at<=now())
      ON CONFLICT DO NOTHING`;
    return NextResponse.json({success:true});
  } catch(e) { return fpoError(e); }
}
