// ============================================================
// 1. POST /api/messages/read/route.ts
// Mark messages as read
// ============================================================
export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { userId, senderId } = await req.json();

    if (!userId || !senderId) {
      return NextResponse.json({ error: 'Missing userId or senderId' }, { status: 400 });
    }

    // Update all unread messages from sender to user
    await sql`
      UPDATE messages 
      SET read_at = ${new Date().toISOString()}
      WHERE sender_id = ${senderId}
        AND receiver_id = ${userId}
        AND read_at IS NULL
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error marking messages as read:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}