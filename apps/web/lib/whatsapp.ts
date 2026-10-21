import { profileReminderNeeds } from '@/lib/profile-reminder-needs';
import sql from '@/app/api/utils/sql';
import { categories, type Category, normalizeWhatsAppPhone, sendTemplate } from '@/lib/whatsapp-core';
import { createHash } from 'node:crypto';

export async function enqueueWhatsApp(userId: string, category: Category, eventKey: string) {
 if (process.env.WHATSAPP_ENABLED !== 'true') return;
 try {
  await sql`INSERT INTO whatsapp_outbox(user_id,category,event_key)
   SELECT p.user_id,${category},${eventKey} FROM whatsapp_preferences p
   WHERE p.user_id=${userId} AND p.opted_in=true
    AND CASE ${category} WHEN 'profile_completion' THEN p.profile_completion
     WHEN 'crop_addition' THEN p.crop_addition ELSE p.nearby_matches END
   ON CONFLICT(user_id,category,event_key) DO NOTHING`;
 } catch { console.error('WhatsApp enqueue failed'); }
}
export function matchEventKey(ids: string[], crop: string) {
 return createHash('sha256').update(JSON.stringify([crop.trim().toLowerCase(), [...new Set(ids)].sort()])).digest('hex');
}
// Existing notification feed uses the same missing crop/location conditions for farmers and buyers.
export async function enqueueWhatsAppReminders() {
 if (process.env.WHATSAPP_ENABLED !== 'true') return;
 const rows = await sql`SELECT u.id,u.latitude,u.longitude,
  EXISTS(SELECT 1 FROM crops c WHERE c.user_id=u.id) AS has_crops
  FROM "user" u JOIN whatsapp_preferences p ON p.user_id=u.id
  WHERE p.opted_in=true AND (u.role IN ('farmer','buyer') OR u.role_id IN (1,2))`;
 for (const u of rows) {
  // Lifetime event keys prevent repeated nags for an unchanged incomplete profile.
  const { needsCrops, needsLocation } = profileReminderNeeds({crop_count:u.has_crops ? 1 : 0,latitude:u.latitude,longitude:u.longitude});
  if (needsLocation) await enqueueWhatsApp(u.id,'profile_completion','missing-location-v1');
  else if (needsCrops) await enqueueWhatsApp(u.id,'crop_addition','no-crops-v1');
 }
}
export async function processWhatsAppQueue() {
 if (process.env.WHATSAPP_ENABLED !== 'true') return { disabled: true };
 const connection = await sql.reserve();
 let locked = false;
 const counts = { accepted: 0, simulated: 0, skipped: 0 };
 try {
  const [lock] = await connection`SELECT pg_try_advisory_lock(74621,20) AS acquired`;
  locked = lock.acquired;
  if (!locked) return { busy: true };
  // A worker crash after dispatch is ambiguous: quarantine instead of resending.
  await sql`UPDATE whatsapp_outbox SET status='unknown',error_code='worker_interrupted',sent_at=now()
   WHERE status='sending' AND next_attempt_at < now()-interval '10 minutes'`;
  // Persisted webhooks also cover callbacks that arrived before send commit.
  await sql`UPDATE whatsapp_outbox o SET status=e.status,status_at=e.occurred_at,error_code=e.error_code
   FROM (SELECT DISTINCT ON(message_id) message_id,status,occurred_at,error_code
    FROM whatsapp_status_events ORDER BY message_id,
     CASE status WHEN 'read' THEN 3 WHEN 'delivered' THEN 2 ELSE 1 END DESC,occurred_at DESC) e
   WHERE o.message_id=e.message_id AND o.status!='read'
    AND (o.status!='delivered' OR e.status='read') AND (o.status_at IS NULL OR o.status_at<=e.occurred_at)`;
  const rows = await sql`SELECT id,user_id,category FROM whatsapp_outbox
   WHERE status='pending' AND next_attempt_at<=now() ORDER BY id LIMIT 10`;
  for (const row of rows) {
   const claimed = await sql`UPDATE whatsapp_outbox SET status='sending',next_attempt_at=now()
    WHERE id=${row.id} AND status='pending' RETURNING id`;
   if (!claimed.length) continue;
   await sql.begin(async tx => {
    // Consent updates use the same row lock, serializing opt-out with dispatch.
    const [p] = await tx`SELECT p.*,u.phone AS registered_phone,u.latitude,u.longitude,
      EXISTS(SELECT 1 FROM crops c WHERE c.user_id=u.id) AS has_crops
      FROM whatsapp_preferences p JOIN "user" u ON u.id=p.user_id WHERE p.user_id=${row.user_id} FOR UPDATE OF p`;
    const category = row.category as Category;
    const phone = normalizeWhatsAppPhone(p?.registered_phone);
    if (!p?.opted_in || !p[category] || !phone || phone !== p.phone ||
      (category==='profile_completion' && p.latitude!=null && p.longitude!=null) ||
      (category==='crop_addition' && p.has_crops)) {
      await tx`UPDATE whatsapp_outbox SET status='cancelled' WHERE id=${row.id}`;
      counts.skipped++; return;
    }
    const allowlist = (process.env.WHATSAPP_ROLLOUT_USER_IDS || '').split(',').map(x=>x.trim()).filter(Boolean);
    if (!allowlist.includes(row.user_id)) { await tx`UPDATE whatsapp_outbox SET status='pending',next_attempt_at=now()+interval '1 hour' WHERE id=${row.id}`; counts.skipped++; return; }
    if (process.env.WHATSAPP_DRY_RUN !== 'false') { await tx`UPDATE whatsapp_outbox SET status='pending',next_attempt_at=now()+interval '1 hour' WHERE id=${row.id}`; counts.simulated++; return; }
    if (!categories.every(c => process.env['WHATSAPP_TEMPLATE_' + c.toUpperCase()]) || process.env.WHATSAPP_TEMPLATES_APPROVED !== 'true') { await tx`UPDATE whatsapp_outbox SET status='pending',next_attempt_at=now()+interval '1 hour' WHERE id=${row.id}`; return; }
    const [usage] = await tx`SELECT
     count(*) FILTER(WHERE user_id=${row.user_id} AND sent_at>now()-interval '7 days')::int AS user_count,
     count(*) FILTER(WHERE sent_at>now()-interval '24 hours')::int AS total_count
     FROM whatsapp_outbox WHERE status IN ('accepted','sent','delivered','read','unknown','failed')`;
    const cap = Math.max(1,Math.min(100,Number(process.env.WHATSAPP_DAILY_CAP) || 20));
    if (usage.user_count>=1 || usage.total_count>=cap) { await tx`UPDATE whatsapp_outbox SET status='pending',next_attempt_at=now()+interval '1 day' WHERE id=${row.id}`; return; }
    await tx`UPDATE whatsapp_outbox SET status='sending',attempts=attempts+1,next_attempt_at=now() WHERE id=${row.id}`;
    const result = await sendTemplate(phone,category);
    if (result.kind==='accepted') {
     await tx`UPDATE whatsapp_outbox SET status='accepted',message_id=${result.id},sent_at=now(),error_code=NULL WHERE id=${row.id}`;
     counts.accepted++;
    } else if (result.kind==='retry') {
     await tx`UPDATE whatsapp_outbox SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'pending' END,
      next_attempt_at=now()+${result.delay}*interval '1 second',error_code=${result.code} WHERE id=${row.id}`;
    } else {
     await tx`UPDATE whatsapp_outbox SET status=${result.kind==='configuration'?'pending':result.kind},
      next_attempt_at=now()+interval '1 hour',error_code=${'code' in result ? result.code! : result.kind},
      sent_at=CASE WHEN ${result.kind==='unknown'} THEN now() ELSE sent_at END WHERE id=${row.id}`;
    }
   });
  }
  return counts;
 } finally { try { if (locked) await connection`SELECT pg_advisory_unlock(74621,20)`; } finally { connection.release(); } }
}
