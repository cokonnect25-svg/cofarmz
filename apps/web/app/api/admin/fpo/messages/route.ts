import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';
import { requireFpoReviewer, fpoError, FpoError } from '@/lib/fpo-access';
export const dynamic = 'force-dynamic';

// Explicit administrative review. Does not enroll admins or deliver group pushes to them.
export async function GET(request: Request) {
  try {
    await requireFpoReviewer(request);
    const q = new URL(request.url).searchParams;
    const group = q.get('group');
    const offset = Number(q.get('offset') || 0);
    if (!group || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(group)) throw new FpoError('Valid group required');
    if (!Number.isSafeInteger(offset) || offset < 0) throw new FpoError('Invalid offset');
    const [details] = await sql`SELECT g.id,f.id AS digital_fpo_id,f.name,f.status,d.state,d.district
      FROM farmer_groups g JOIN digital_fpos f ON f.id=g.digital_fpo_id
      JOIN fpo_districts d ON d.id=f.district_id WHERE g.id=${group}`;
    if (!details) throw new FpoError('Group not found',404);
    const rows = await sql`SELECT a.id,a.title,a.body,a.created_at,a.scheduled_at,a.expires_at,u.name AS sender_name
      FROM announcements a LEFT JOIN "user" u ON u.id=a.created_by
      WHERE a.group_id=${group} ORDER BY a.created_at DESC,a.id DESC LIMIT 51 OFFSET ${offset}`;
    return NextResponse.json({ group:details,messages:rows.slice(0,50),next:rows.length>50?offset+50:null },{headers:{'Cache-Control':'private, no-store'}});
  } catch(e) { return fpoError(e); }
}
