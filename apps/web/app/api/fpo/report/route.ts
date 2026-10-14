import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { requireActor, canReviewFpos, FpoError, fpoError } from '@/lib/fpo-access';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    let scope: { district_id: string; taluk_id: string | null } | null = null;
    if (!canReviewFpos(actor.role)) {
      const [manager] = await sql`SELECT f.district_id,f.taluk_id,f.status,m.must_change_password
        FROM fpo_manager_accounts m JOIN digital_fpos f ON f.id=m.digital_fpo_id WHERE m.user_id=${actor.id}`;
      if (!manager || manager.must_change_password || manager.status !== 'active') throw new FpoError('Active FPO manager access and password setup required',403);
      scope = { district_id: String(manager.district_id), taluk_id: manager.taluk_id == null ? null : String(manager.taluk_id) };
    }
    const q = new URL(request.url).searchParams;
    const district = q.get('district') || null, taluk = q.get('taluk') || null, group = q.get('group') || null;
    for (const id of [district,taluk]) if (id && !/^[1-9][0-9]*$/.test(id)) throw new FpoError('Invalid district or mandal/taluk');
    if (group && !/^[0-9a-f-]{36}$/i.test(group)) throw new FpoError('Invalid group');
    if (scope && ((district && String(scope.district_id)!==district) || (scope.taluk_id && taluk && String(scope.taluk_id)!==taluk))) throw new FpoError('This location is outside your FPO',403);
    const fpos = await sql`SELECT f.id,f.name,f.status,f.district_id,f.taluk_id,d.state,d.district,t.name AS taluk,g.id AS group_id
      FROM digital_fpos f JOIN fpo_districts d ON d.id=f.district_id LEFT JOIN fpo_taluks t ON t.id=f.taluk_id JOIN farmer_groups g ON g.digital_fpo_id=f.id
      WHERE (${scope?.district_id || null}::bigint IS NULL OR f.district_id=${scope?.district_id || null}::bigint)
        AND (${scope?.taluk_id || null}::bigint IS NULL OR f.taluk_id=${scope?.taluk_id || null}::bigint)
      ORDER BY d.state,d.district,t.name NULLS FIRST`;
    const selected = group ? fpos.find(f=>f.group_id===group) : null;
    if (group && !selected) throw new FpoError('FPO unavailable or outside your access',403);
    const included = fpos.filter(f => (!district || String(f.district_id)===district) && (!taluk || String(f.taluk_id)===taluk)
      && (!selected || (selected.taluk_id ? f.group_id===group : String(f.district_id)===String(selected.district_id))));
    if (q.get('options')==='true') return NextResponse.json({ fpos }, { headers: { 'Cache-Control':'private, no-store' } });
    const groups = included.map(f=>f.group_id);
    const farmers = groups.length ? await sql`SELECT u.id,u.name,u.location,u.latitude,u.longitude,d.district,d.state,t.name AS taluk,u.taluk_id,
      a.group_id,a.assignment_status,a.assignment_source,a.reason,
      jsonb_build_object('email',u.email,'phone',u.phone,'gender',to_jsonb(u)->>'gender','age',to_jsonb(u)->>'age','bio',to_jsonb(u)->>'bio',
        'email_verified',to_jsonb(u)->>'emailVerified','phone_verified',to_jsonb(u)->>'phone_verified',
        'created_at',to_jsonb(u)->>'createdAt','updated_at',to_jsonb(u)->>'updatedAt') AS profile_details
      FROM farmer_fpo_assignments a JOIN "user" u ON u.id=a.farmer_id
      LEFT JOIN fpo_districts d ON d.id=u.district_id LEFT JOIN fpo_taluks t ON t.id=u.taluk_id
      WHERE u.role='farmer' AND a.group_id=ANY(${groups}::uuid[]) AND u.id>${q.get('after') || ''}
        AND (${scope?.district_id || null}::bigint IS NULL OR u.district_id=${scope?.district_id || null}::bigint)
        AND (${scope?.taluk_id || null}::bigint IS NULL OR u.taluk_id=${scope?.taluk_id || null}::bigint)
      ORDER BY u.id LIMIT 100` : [];
    return NextResponse.json({ fpos:included, farmers, next: farmers.length===100 ? farmers[farmers.length-1].id : null }, { headers: { 'Cache-Control':'private, no-store' } });
  } catch (e) { return fpoError(e); }
}
