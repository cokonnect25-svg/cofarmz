

// ============================================================
// 8. POST /api/users/heartbeat/route.ts
// Update user's last_seen timestamp
// ============================================================
export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    await sql`
      UPDATE "user" 
      SET last_seen = ${new Date().toISOString()}
      WHERE id = ${userId}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating heartbeat:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}