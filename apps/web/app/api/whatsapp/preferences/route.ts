import { NextResponse } from 'next/server';
import { requireActor, FpoError } from '@/lib/fpo-access';
import sql from '@/app/api/utils/sql';
import { categories, normalizeWhatsAppPhone } from '@/lib/whatsapp-core';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
 try {
  const actor = await requireActor(request);
  const [p] = await sql`SELECT opted_in,profile_completion,crop_addition,nearby_matches,consent_at FROM whatsapp_preferences WHERE user_id=${actor.id}`;
  return NextResponse.json(p || {opted_in:false,profile_completion:true,crop_addition:true,nearby_matches:true});
 } catch(error) { return NextResponse.json({error:error instanceof FpoError ? error.message : 'WhatsApp preferences are unavailable'},{status:error instanceof FpoError ? error.status : 503}); }
}
export async function PUT(request: Request) {
 try {
  const actor = await requireActor(request);
  const body = await request.json();
  if (typeof body.opted_in !== 'boolean' || categories.some(c => typeof body[c] !== 'boolean')) throw new FpoError('Invalid preferences');
  if (body.opted_in && body.consent !== true) throw new FpoError('Please confirm WhatsApp consent');
  await sql.begin(async tx => {
   const [user] = await tx`SELECT phone FROM "user" WHERE id=${actor.id}`;
   const phone = normalizeWhatsAppPhone(user?.phone);
   if (body.opted_in && !phone) throw new FpoError('Add a valid mobile number to your profile first');
   await tx`INSERT INTO whatsapp_preferences(user_id,phone,opted_in,consent_at,consent_source,opted_out_at,profile_completion,crop_addition,nearby_matches)
    VALUES(${actor.id},${phone || ''},${body.opted_in},CASE WHEN ${body.opted_in} THEN now() ELSE NULL END,
     'settings-v1',CASE WHEN ${!body.opted_in} THEN now() ELSE NULL END,${body.profile_completion},${body.crop_addition},${body.nearby_matches})
    ON CONFLICT(user_id) DO UPDATE SET phone=EXCLUDED.phone,opted_in=EXCLUDED.opted_in,
     consent_at=CASE WHEN EXCLUDED.opted_in THEN now() ELSE whatsapp_preferences.consent_at END,
     consent_source='settings-v1',opted_out_at=EXCLUDED.opted_out_at,profile_completion=EXCLUDED.profile_completion,
     crop_addition=EXCLUDED.crop_addition,nearby_matches=EXCLUDED.nearby_matches,updated_at=now()`;
   if (!body.opted_in) await tx`UPDATE whatsapp_outbox SET status='cancelled' WHERE user_id=${actor.id} AND status='pending'`;
  });
  return NextResponse.json({success:true});
 } catch(error) { return NextResponse.json({error:error instanceof FpoError ? error.message : 'WhatsApp preferences are unavailable'},{status:error instanceof FpoError ? error.status : 503}); }
}
