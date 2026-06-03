export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const [user] = await sql`
      SELECT last_seen FROM "user" WHERE id = ${userId}
    `;

    const isOnline = user?.last_seen 
      ? (new Date().getTime() - new Date(user.last_seen).getTime()) < ONLINE_THRESHOLD_MS
      : false;

    return NextResponse.json({ 
      isOnline, 
      lastSeen: user?.last_seen 
    });
  } catch (error: any) {
    console.error('Error checking online status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
