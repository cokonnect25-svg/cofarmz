import sql from '@/app/api/utils/sql';
import {sendPushToUser} from '@/app/api/utils/push';

export async function ensureYieldReminderTable() {
 await sql`CREATE TABLE IF NOT EXISTS crop_yield_reminders (
  id BIGSERIAL PRIMARY KEY,user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  reminder_day DATE NOT NULL,crop_names TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  push_sent_at TIMESTAMPTZ,UNIQUE(user_id,reminder_day))`;
}
// Compare DATE values using the farmer service's India calendar; today is not overdue.
export async function sendDailyYieldReminders() {
 await ensureYieldReminderTable();
 const connection=await sql.reserve();let locked=false;
 try {
  const [lock]=await connection`SELECT pg_try_advisory_lock(74621,2) AS acquired`;
  locked=lock.acquired;if(!locked)return {skipped:true,sent:0,failed:0};
  await sql`INSERT INTO crop_yield_reminders(user_id,reminder_day,crop_names)
   SELECT u.id,(now() AT TIME ZONE 'Asia/Kolkata')::date,string_agg(DISTINCT c.crop_name, ', ' ORDER BY c.crop_name)
   FROM crops c JOIN "user" u ON u.id=c.user_id
   WHERE u.role='farmer' AND c.expected_yield_date < (now() AT TIME ZONE 'Asia/Kolkata')::date
   GROUP BY u.id ON CONFLICT(user_id,reminder_day) DO NOTHING`;
  const pending=await sql`SELECT r.id,r.user_id,
    (SELECT string_agg(DISTINCT c.crop_name, ', ' ORDER BY c.crop_name) FROM crops c
      WHERE c.user_id=r.user_id AND c.expected_yield_date < (now() AT TIME ZONE 'Asia/Kolkata')::date) AS crop_names
   FROM crop_yield_reminders r WHERE r.reminder_day=(now() AT TIME ZONE 'Asia/Kolkata')::date AND r.push_sent_at IS NULL
    AND EXISTS(SELECT 1 FROM crops c JOIN "user" u ON u.id=c.user_id WHERE c.user_id=r.user_id
      AND u.role='farmer' AND c.expected_yield_date < (now() AT TIME ZONE 'Asia/Kolkata')::date)`;
  let sent=0,failed=0;
  for(const row of pending){
   const result=await sendPushToUser(row.user_id,{title:'Update your crop yield date',
    body:`The yield date for ${row.crop_names} has passed. Please update your current crops with a new yield date.`,
    url:'/user-profile#current-crops',tag:'crop-yield-reminder'});
   if(result.failed===0 || result.succeeded>0){await sql`UPDATE crop_yield_reminders SET push_sent_at=now() WHERE id=${row.id}`;sent++;}
   else failed++;
  }
  return {skipped:false,sent,failed};
 } finally {try{if(locked)await connection`SELECT pg_advisory_unlock(74621,2)`;}finally{connection.release();}}
}
