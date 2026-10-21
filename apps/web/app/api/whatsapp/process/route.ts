import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { enqueueWhatsAppReminders, processWhatsAppQueue } from '@/lib/whatsapp';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
 const expected=process.env.WHATSAPP_SCHEDULER_SECRET;
 const supplied=request.headers.get('x-scheduler-secret') || '';
 if (!expected || Buffer.byteLength(supplied)!==Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))) return new Response('Forbidden',{status:403});
 try { await enqueueWhatsAppReminders(); return NextResponse.json(await processWhatsAppQueue()); }
 catch { console.error('WhatsApp queue processing failed'); return NextResponse.json({error:'Queue unavailable'},{status:503}); }
}
