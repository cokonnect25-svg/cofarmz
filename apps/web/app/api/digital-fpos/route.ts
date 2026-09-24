import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';
import { requireActor, isSuperAdmin, canReviewFpos, fpoError, FpoError } from '@/lib/fpo-access';
import { fpoName, validateDistrict } from '@/lib/fpo-location';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const rows = await sql`SELECT f.*,d.state,d.district,g.id AS group_id,f.name AS group_name,
      (SELECT count(*)::int FROM farmer_fpo_assignments a JOIN "user" u ON u.id=a.farmer_id WHERE a.group_id=g.id AND u.role='farmer' AND (${canReviewFpos(actor.role)} OR can_receive_fpo_message(u.id,g.id))) AS farmer_count
      FROM digital_fpos f JOIN fpo_districts d ON d.id=f.district_id
      JOIN farmer_groups g ON g.digital_fpo_id=f.id
      WHERE f.status='active' OR ${canReviewFpos(actor.role)} ORDER BY d.state,d.district`;
    const [mine] = await sql`SELECT a.*,d.state,d.district,f.id AS digital_fpo_id,f.name,g.id AS current_group_id
      FROM farmer_fpo_assignments a LEFT JOIN fpo_districts d ON d.id=a.district_id
      LEFT JOIN farmer_groups g ON g.id=a.group_id LEFT JOIN digital_fpos f ON f.id=g.digital_fpo_id WHERE a.farmer_id=${actor.id}`;
    if (mine?.group_id) {
      const [access] = await sql`SELECT can_receive_fpo_message(${actor.id},${mine.group_id}) AS allowed`;
      if (!access.allowed) mine.assignment_status = 'inactive_fpo';
    }
    return NextResponse.json({ fpos: rows, mine: mine || null, can_manage: isSuperAdmin(actor.role), can_review: canReviewFpos(actor.role) });
  } catch (e) { return fpoError(e); }
}
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request,true);
    const body = await request.json();
    const district = await validateDistrict(body.state,body.district);
    const result = await sql.begin(async tx => {
      const [fpo] = await tx`INSERT INTO digital_fpos(district_id,name,created_by) VALUES(${district.id},${fpoName(district.district,district.state)},${actor.id}) RETURNING *`;
      const [group] = await tx`INSERT INTO farmer_groups(digital_fpo_id) VALUES(${fpo.id}) RETURNING id`;
      return { ...fpo, group_id: group.id };
    });
    return NextResponse.json(result,{status:201});
  } catch (e) { return fpoError(e); }
}
export async function PATCH(request: Request) {
  try {
    await requireActor(request,true);
    const body = await request.json();
    if (!['active','inactive'].includes(body.status) || !/^[0-9a-f-]{36}$/i.test(body.id)) throw new FpoError('Valid FPO and status required');
    const [fpo] = await sql`UPDATE digital_fpos SET status=${body.status},updated_at=now() WHERE id=${body.id} RETURNING *`;
    if (!fpo) throw new FpoError('FPO not found',404);
    // Access predicate immediately blocks inactive FPOs without destroying the association.
    return NextResponse.json(fpo);
  } catch (e) { return fpoError(e); }
}
