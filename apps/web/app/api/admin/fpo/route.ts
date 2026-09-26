import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';
import { requireActor, requireFpoReviewer, fpoError, FpoError } from '@/lib/fpo-access';
import { validateDistrict } from '@/lib/fpo-location';
import { assignFarmer, processFarmer } from '@/lib/fpo-assignment';
import { provisionCatalogue } from '@/lib/fpo-provision';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await requireFpoReviewer(request);
    const q = new URL(request.url).searchParams;
    const after = q.get('after') || '';
    const group = q.get('group') || null;
    if (group && !/^[0-9a-f-]{36}$/i.test(group)) throw new FpoError('Invalid group');
    const rows = await sql`SELECT u.id,u.name,u.location,u.latitude,u.longitude,d.state,d.district,
      CASE WHEN ${q.get('details') === 'true'} THEN jsonb_build_object(
        'email',u.email,'phone',u.phone,'gender',to_jsonb(u)->>'gender',
        'age',to_jsonb(u)->>'age','bio',to_jsonb(u)->>'bio',
        'email_verified',to_jsonb(u)->>'emailVerified','phone_verified',to_jsonb(u)->>'phone_verified',
        'created_at',to_jsonb(u)->>'createdAt','updated_at',to_jsonb(u)->>'updatedAt'
      ) ELSE NULL END AS profile_details,
      CASE WHEN a.group_id IS NOT NULL AND NOT can_receive_fpo_message(u.id,a.group_id) THEN 'inactive_fpo' ELSE COALESCE(a.assignment_status,'pending_location') END AS assignment_status,a.reason,a.assignment_source,a.group_id
      FROM "user" u LEFT JOIN farmer_fpo_assignments a ON a.farmer_id=u.id LEFT JOIN fpo_districts d ON d.id=u.district_id
      WHERE u.role='farmer' AND u.id>${after}
        AND (${group}::uuid IS NULL OR a.group_id=${group}::uuid)
        AND (${q.get('pending') === 'true'}=false OR a.group_id IS NULL OR NOT can_receive_fpo_message(u.id,a.group_id))
      ORDER BY u.id LIMIT 100`;
    return NextResponse.json({ farmers:rows, next: rows.length === 100 ? rows[rows.length-1].id : null }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch(e) { return fpoError(e); }
}
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request,true);
    const body = await request.json();
    if (body.action === 'provision') return NextResponse.json(await provisionCatalogue(actor.id));
    if (body.action === 'assign') {
      const district = await validateDistrict(body.state,body.district);
      const result = await sql.begin(async tx => {
        const [u] = await tx`SELECT * FROM "user" WHERE id=${String(body.farmer_id)} FOR UPDATE`;
        if (u?.role !== 'farmer') throw new FpoError('User must be a farmer');
        await tx`UPDATE "user" SET district_id=${district.id},"updatedAt"=now() WHERE id=${u.id}`;
        return assignFarmer(tx,u.id,district.id,'admin_manual');
      });
      return NextResponse.json(result);
    }
    if (body.action !== 'process') throw new FpoError('Invalid action');
    const after = String(body.after || '');
    const batch = await sql`SELECT id FROM "user" WHERE role='farmer' AND id>${after} ORDER BY id LIMIT 10`;
    const catalogue = await sql`SELECT id,state,district FROM fpo_districts`;
    const results = [];
    for (const u of batch) {
      try { results.push(await processFarmer(u.id,body.dry_run !== false,catalogue)); }
      catch (e) { results.push({ farmer_id:u.id, error: e instanceof FpoError ? e.message : 'Processing failed; retry this farmer' }); }
    }
    return NextResponse.json({ results, next: batch.length === 10 ? batch[batch.length-1].id : null });
  } catch(e) { return fpoError(e); }
}
