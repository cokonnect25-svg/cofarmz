import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';
import { requireActor, canReviewFpos, fpoError, FpoError } from '@/lib/fpo-access';
import { validateTaluk } from '@/lib/fpo-taluk';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, {params}: {params:Promise<{id:string}>}) {
  try {
    const actor=await requireActor(request);
    const {id}=await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new FpoError('Invalid FPO ID');
    const [fpo]=await sql`SELECT f.*,d.state,d.district,t.name AS taluk FROM digital_fpos f
      JOIN fpo_districts d ON d.id=f.district_id LEFT JOIN fpo_taluks t ON t.id=f.taluk_id WHERE f.id=${id}`;
    if (!fpo) throw new FpoError('FPO not found',404);
    if (!canReviewFpos(actor.role)) {
      const [grant]=await sql`SELECT m.user_id FROM fpo_manager_accounts m JOIN digital_fpos f ON f.id=m.digital_fpo_id
        WHERE m.user_id=${actor.id} AND NOT m.must_change_password AND f.status='active'
          AND (f.id=${id} OR (f.taluk_id IS NULL AND f.district_id=${fpo.district_id}))`;
      if (!grant || fpo.status!=='active') throw new FpoError('FPO review access required',403);
    }
    const q=new URL(request.url).searchParams;
    const filter=q.get('taluk') || null;
    if (filter && filter!=='unresolved') await validateTaluk(filter,fpo.district_id);
    if (fpo.taluk_id && filter && String(fpo.taluk_id)!==filter) throw new FpoError('Mandal/taluk is outside this FPO',403);
    const talukId=fpo.taluk_id || (filter && filter!=='unresolved' ? filter : null);
    const [parent]=await sql`SELECT id,name,status FROM digital_fpos WHERE district_id=${fpo.district_id} AND taluk_id IS NULL`;
    const subgroups=await sql`SELECT t.id AS taluk_id,t.name AS taluk,f.id,f.name,f.status,g.id AS group_id,
      (SELECT count(*)::int FROM "user" u WHERE u.role='farmer' AND u.district_id=t.district_id AND u.taluk_id=t.id) AS farmer_count
      FROM fpo_taluks t LEFT JOIN digital_fpos f ON f.taluk_id=t.id LEFT JOIN farmer_groups g ON g.digital_fpo_id=f.id
      WHERE t.district_id=${fpo.district_id} AND (${fpo.taluk_id || null}::bigint IS NULL OR t.id=${fpo.taluk_id || null}::bigint)
      ORDER BY t.name,t.id`;
    const [totals]=await sql`SELECT count(*)::int AS district_farmers,
      count(*) FILTER(WHERE taluk_id IS NULL)::int AS unresolved_taluk
      FROM "user" WHERE role='farmer' AND district_id=${fpo.district_id}`;
    const farmers=await sql`SELECT u.id,u.name,t.name AS taluk,u.taluk_id,f.name AS fpo_name,f.id AS digital_fpo_id,
      CASE WHEN a.group_id IS NOT NULL AND NOT can_receive_fpo_message(u.id,a.group_id) THEN 'inactive_fpo' ELSE COALESCE(a.assignment_status,'pending_location') END AS assignment_status
      FROM "user" u LEFT JOIN fpo_taluks t ON t.id=u.taluk_id
      LEFT JOIN farmer_fpo_assignments a ON a.farmer_id=u.id
      LEFT JOIN farmer_groups g ON g.id=a.group_id LEFT JOIN digital_fpos f ON f.id=g.digital_fpo_id
      WHERE u.role='farmer' AND u.district_id=${fpo.district_id} AND u.id>${q.get('after') || ''}
        AND (${talukId}::bigint IS NULL OR u.taluk_id=${talukId}::bigint)
        AND (${filter==='unresolved'}=false OR u.taluk_id IS NULL)
      ORDER BY u.id LIMIT 100`;
    // Taluk managers must not receive district-wide totals or sibling information.
    return NextResponse.json({fpo,parent:parent || null,subgroups,
      totals:fpo.taluk_id?{district_farmers:subgroups[0]?.farmer_count || 0,unresolved_taluk:0}:totals,
      farmers,next:farmers.length===100?farmers[farmers.length-1].id:null},
      {headers:{'Cache-Control':'private, no-store'}});
  } catch(e) { return fpoError(e); }
}
