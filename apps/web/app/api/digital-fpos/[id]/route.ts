import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';
import { requireActor, canReviewFpos, fpoError, FpoError } from '@/lib/fpo-access';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, {params}: {params: Promise<{id:string}>}) {
  try {
    const actor = await requireActor(request);
    const {id} = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new FpoError('Invalid FPO ID');
    const [fpo] = await sql`SELECT f.*,d.state,d.district,g.id AS group_id,f.name AS group_name
      FROM digital_fpos f JOIN fpo_districts d ON d.id=f.district_id JOIN farmer_groups g ON g.digital_fpo_id=f.id
      WHERE f.id=${id} AND (f.status='active' OR ${canReviewFpos(actor.role)})`;
    if (!fpo) throw new FpoError('FPO not found',404);
    // No messages or member personal information are included in public profiles.
    return NextResponse.json(fpo);
  } catch(e) { return fpoError(e); }
}
