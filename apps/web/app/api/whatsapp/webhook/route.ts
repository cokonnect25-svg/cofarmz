import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { normalizeWhatsAppPhone, validSignature } from '@/lib/whatsapp-core';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
 const params = new URL(request.url).searchParams;
 const secret = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
 if (!secret || params.get('hub.mode')!=='subscribe' || params.get('hub.verify_token')!==secret) return new Response('Forbidden',{status:403});
 return new Response(params.get('hub.challenge') || '',{headers:{'Content-Type':'text/plain'}});
}
export async function POST(request: Request) {
 const raw = await request.text();
 if (!validSignature(raw,request.headers.get('x-hub-signature-256'),process.env.WHATSAPP_APP_SECRET || '')) return new Response('Forbidden',{status:403});
 try {
  const payload = JSON.parse(raw);
  if (payload.object !== 'whatsapp_business_account') return NextResponse.json({received:true});
  for (const entry of payload.entry || []) for (const change of entry.changes || []) {
   const value = change.value;
   if (!process.env.WHATSAPP_PHONE_NUMBER_ID || value?.metadata?.phone_number_id!==process.env.WHATSAPP_PHONE_NUMBER_ID) continue;
   for (const message of value.messages || []) {
    const text = String(message.text?.body || message.button?.payload || message.button?.text || '').trim().toUpperCase();
    const phone = normalizeWhatsAppPhone(message.from);
    if (phone && ['STOP','UNSUBSCRIBE','CANCEL','OPT OUT','STOP_WHATSAPP'].includes(text)) {
     await sql.begin(async tx => {
      const users = await tx`UPDATE whatsapp_preferences SET opted_in=false,opted_out_at=now(),updated_at=now()
       WHERE phone=${phone} RETURNING user_id`;
      for (const u of users) await tx`UPDATE whatsapp_outbox SET status='cancelled' WHERE user_id=${u.user_id} AND status='pending'`;
     });
    }
   }
   for (const status of value.statuses || []) {
    if (!['sent','delivered','read','failed'].includes(status.status) || !/^\d+$/.test(String(status.timestamp))) continue;
    const date = new Date(Number(status.timestamp)*1000);
    if (!Number.isFinite(date.getTime())) continue;
    await sql`INSERT INTO whatsapp_status_events(message_id,status,occurred_at,error_code)
     VALUES(${String(status.id)},${status.status},${date},${status.status==='failed' ? String(Number(status.errors?.[0]?.code) || 0) : null})
     ON CONFLICT DO NOTHING`;
    // Out-of-order/replayed callbacks never downgrade delivered/read messages.
    await sql`UPDATE whatsapp_outbox SET status=${status.status},status_at=${date},
     error_code=${status.status==='failed' ? String(Number(status.errors?.[0]?.code) || 0) : null}
     WHERE message_id=${String(status.id)} AND (status_at IS NULL OR status_at<=${date})
      AND status!='read' AND (status!='delivered' OR ${status.status==='read'})`;
   }
  }
  return NextResponse.json({received:true});
 } catch { console.error('WhatsApp webhook processing failed'); return new Response('Unable to process',{status:500}); }
}
