import sql from '@/app/api/utils/sql';
import { ensurePushTokenTable, sendPushToUser } from '@/app/api/utils/push';
import { sendDailyYieldReminders } from '@/lib/crop-yield-reminders';
import { indiaNotificationClock, notificationCopy, cropMatchCopy } from '@/lib/notification-copy';

// Run from a scheduler: feed polling cannot notify a phone while the app is closed.
export async function sendDailyMobileReminders(now = new Date()) {
  const clock = indiaNotificationClock(now);
  if (clock.hour < 9 || clock.hour >= 21) return {skipped:true,sent:0,failed:0};
  const yieldResult = await sendDailyYieldReminders();
  await ensurePushTokenTable();
  await sql`CREATE TABLE IF NOT EXISTS daily_mobile_reminders (
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    reminder_day DATE NOT NULL, kind TEXT NOT NULL, sent_at TIMESTAMPTZ,
    PRIMARY KEY(user_id, reminder_day, kind))`;
  const connection = await sql.reserve();
  let locked = false;
  try {
    const [lock] = await connection`SELECT pg_try_advisory_lock(74621,3) AS acquired`;
    locked = lock.acquired;
    if (!locked) return { yield: yieldResult, skipped: true, sent: 0, failed: 0 };
    const users = await sql`SELECT u.id,u.latitude,u.longitude,u.supplier_types,
      CASE WHEN LOWER(COALESCE(u.role,''))='farmer' OR u.role_id=1 THEN 'farmer'
        WHEN LOWER(COALESCE(u.role,''))='buyer' OR u.role_id=2 THEN 'buyer'
        ELSE LOWER(COALESCE(u.role,'')) END AS role,
      (SELECT COUNT(*) FROM crops c WHERE c.user_id=u.id) AS crop_count,
      (SELECT COUNT(*) FROM machinery m WHERE m.owner_id=u.id) AS equipment_count
      FROM "user" u WHERE EXISTS(SELECT 1 FROM push_tokens p WHERE p.user_id=u.id AND p.enabled=true)`;
    let sent = 0, failed = 0;
    for (const user of users) {
      const reminders: {kind:string;title:string;body:string;url:string}[] = [];
      const needsCrops = Number(user.crop_count) === 0;
      if (['farmer','buyer'].includes(user.role)) {
        if (needsCrops || user.latitude == null || user.longitude == null) {
          reminders.push({kind:'profile_match_setup',title:'Complete your profile to find crop partners',
            body:needsCrops ? 'Add the crops you grow or want to buy to discover nearby matches.' : 'Add your location to discover crop partners near you.',
            url:needsCrops ? '/user-profile?addCrop=true' : '/user-profile'});
        } else {
          const [match] = await sql`SELECT u.id,u.name,c.crop_name
            FROM "user" u JOIN crops c ON c.user_id=u.id
            WHERE u.id!=${user.id} AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL
              AND EXISTS(SELECT 1 FROM crops own WHERE own.user_id=${user.id}
                AND LOWER(TRIM(own.crop_name))=LOWER(TRIM(c.crop_name)) AND NULLIF(TRIM(own.crop_name),'') IS NOT NULL)
              AND ((${user.role}='farmer' AND (LOWER(COALESCE(u.role,''))='buyer' OR u.role_id=2))
                OR (${user.role}='buyer' AND (LOWER(COALESCE(u.role,''))='farmer' OR u.role_id=1)))
            ORDER BY (SIN(RADIANS(${Number(user.latitude)}))*SIN(RADIANS(u.latitude))+
              COS(RADIANS(${Number(user.latitude)}))*COS(RADIANS(u.latitude))*
              COS(RADIANS(u.longitude)-RADIANS(${Number(user.longitude)}))) DESC,u.id,c.crop_name LIMIT 1`;
          if (match) reminders.push({kind:'profile_match',...cropMatchCopy(match.name,match.crop_name),url:`/farmer-profile?id=${encodeURIComponent(match.id)}`});
        }
      }
      if (user.role === 'supplier') {
        const types: string[] = Array.isArray(user.supplier_types) ? user.supplier_types : [];
        if (needsCrops && (!types.length || types.includes('commodities'))) reminders.push({kind:'profile_completion_crops',
          title:'Add crops to complete your supplier profile',body:'Show nearby buyers what you supply.',url:'/user-profile?addCrop=true'});
        if (Number(user.equipment_count)===0 && (!types.length || types.includes('equipment'))) reminders.push({kind:'profile_completion_equipment',
          title:'Add equipment to complete your supplier profile',body:'List your equipment so nearby users can discover and contact you.',url:'/rent-machinery'});
      }
      // One daytime discovery/profile alert, one evening invitation at most.
      const scheduled = clock.hour >= 18
        ? (['farmer','buyer','supplier'].includes(user.role) ? [{kind:'explore_evening',title:'Explore CoFarmz',body:'Take a look at your farming community.',url:'/reels'}] : [])
        : reminders.slice(0,1);
      for (const reminder of scheduled) {
        await sql`INSERT INTO daily_mobile_reminders(user_id,reminder_day,kind)
          VALUES(${user.id},(now() AT TIME ZONE 'Asia/Kolkata')::date,${reminder.kind}) ON CONFLICT DO NOTHING`;
        const [pending] = await sql`SELECT 1 FROM daily_mobile_reminders WHERE user_id=${user.id}
          AND reminder_day=(now() AT TIME ZONE 'Asia/Kolkata')::date AND kind=${reminder.kind} AND sent_at IS NULL`;
        if (!pending) continue;
        const copy = notificationCopy(reminder.kind,user.id,clock.day,reminder);
        const result = await sendPushToUser(user.id,{...reminder,...copy,tag:`daily-${reminder.kind}`,data:{type:reminder.kind.startsWith('profile_completion') ? 'profile_completion' : reminder.kind}});
        if (result.succeeded > 0) {
          await sql`UPDATE daily_mobile_reminders SET sent_at=now() WHERE user_id=${user.id}
            AND reminder_day=(now() AT TIME ZONE 'Asia/Kolkata')::date AND kind=${reminder.kind}`;
          sent++;
        } else failed++;
      }
    }
    return {yield:yieldResult,skipped:false,sent,failed};
  } finally {
    try { if (locked) await connection`SELECT pg_advisory_unlock(74621,3)`; }
    finally { connection.release(); }
  }
}
