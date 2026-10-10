import { validateFpoContact } from '@/lib/fpo-profile';
import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';
import { requireActor, requireFpoReviewer, canReviewFpos, fpoError, FpoError } from '@/lib/fpo-access';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, {params}: {params: Promise<{id:string}>}) {
  try {
    const actor = await requireActor(request);
    const {id} = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new FpoError('Invalid FPO ID');
    const [fpo] = await sql`SELECT f.*,d.state,d.district,t.name AS taluk,g.id AS group_id,f.name AS group_name
      FROM digital_fpos f JOIN fpo_districts d ON d.id=f.district_id LEFT JOIN fpo_taluks t ON t.id=f.taluk_id JOIN farmer_groups g ON g.digital_fpo_id=f.id
      WHERE f.id=${id} AND (f.status='active' OR ${canReviewFpos(actor.role)})`;
    if (!fpo) throw new FpoError('FPO not found',404);
    // No messages or member personal information are included in public profiles.
    return NextResponse.json(canReviewFpos(actor.role) ? fpo : {id:fpo.id,name:fpo.name,state:fpo.state,district:fpo.district,taluk:fpo.taluk,taluk_id:fpo.taluk_id,status:fpo.status,contact_phone:fpo.contact_phone,office_address:fpo.office_address,latitude:fpo.latitude,longitude:fpo.longitude});
  } catch(e) { return fpoError(e); }
}

export async function PATCH(request: Request, {params}: {params: Promise<{id:string}>}) {
  try {
    await requireFpoReviewer(request);
    const {id} = await params;
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) throw new FpoError('Invalid FPO ID');
    const input = await request.json();
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new FpoError('Profile details required');
    const contact = validateFpoContact(input);
    const [fpo] = await sql`UPDATE digital_fpos SET contact_phone=${contact.contact_phone ?? null},office_address=${contact.office_address ?? null},latitude=${contact.latitude ?? null},longitude=${contact.longitude ?? null},updated_at=now() WHERE id=${id} RETURNING contact_phone,office_address,latitude,longitude`;
    if (!fpo) throw new FpoError('FPO not found',404);
    return NextResponse.json(fpo,{headers:{'Cache-Control':'private, no-store'}});
  } catch(e) { return fpoError(e); }
}
