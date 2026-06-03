// ============================================================
// 7. GET /api/users/online-batch/route.ts
// Batch check online statuses
// ============================================================
export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userIdsParam = searchParams.get('userIds');

    if (!userIdsParam) {
      return NextResponse.json({ statuses: {} });
    }

    const userIds = userIdsParam.split(',').filter(Boolean);

    if (userIds.length === 0) {
      return NextResponse.json({ statuses: {} });
    }

    const users = await sql`
      SELECT id, last_seen 
      FROM "user" 
      WHERE id = ANY(${userIds})
    `;

    const statuses: Record<string, { isOnline: boolean; lastSeen: string | null }> = {};
    const now = new Date().getTime();

    for (const user of users) {
      statuses[user.id] = {
        isOnline: user.last_seen 
          ? (now - new Date(user.last_seen).getTime()) < ONLINE_THRESHOLD_MS
          : false,
        lastSeen: user.last_seen
      };
    }

    return NextResponse.json({ statuses });
  } catch (error: any) {
    console.error('Error checking batch online status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}