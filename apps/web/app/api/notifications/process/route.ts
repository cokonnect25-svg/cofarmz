import { NextResponse } from 'next/server';
import { sendDailyMobileReminders } from '@/lib/daily-mobile-reminders';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.NOTIFICATION_SCHEDULER_SECRET;
  if (!secret) return NextResponse.json({error:'NOTIFICATION_SCHEDULER_SECRET is not configured'},{status:503});
  if (request.headers.get('x-scheduler-secret') !== secret) return NextResponse.json({error:'Unauthorized'},{status:401});
  try {
    return NextResponse.json(await sendDailyMobileReminders());
  } catch (error) {
    console.error('Mobile reminder processing failed:',error);
    return NextResponse.json({error:'Mobile reminder processing failed'},{status:500});
  }
}
