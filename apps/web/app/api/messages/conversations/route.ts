// ============================================================
// 3. DELETE /api/messages/conversation/route.ts
// Delete entire conversation
// ============================================================
export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";


const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export async function DELETE(req: NextRequest) {
  try {
    const { userId, otherUserId } = await req.json();

    if (!userId || !otherUserId) {
      return NextResponse.json({ error: 'Missing userId or otherUserId' }, { status: 400 });
    }

    // Mark messages where user is sender as deleted_by_sender
    await sql`
      UPDATE messages 
      SET deleted_by_sender = true
      WHERE sender_id = ${userId} AND receiver_id = ${otherUserId}
    `;

    // Mark messages where user is receiver as deleted_by_receiver
    await sql`
      UPDATE messages 
      SET deleted_by_receiver = true
      WHERE sender_id = ${otherUserId} AND receiver_id = ${userId}
    `;

    // Hard delete messages where both have deleted
    await sql`
      DELETE FROM messages 
      WHERE (
        (sender_id = ${userId} AND receiver_id = ${otherUserId} AND deleted_by_sender = true AND deleted_by_receiver = true)
        OR
        (sender_id = ${otherUserId} AND receiver_id = ${userId} AND deleted_by_sender = true AND deleted_by_receiver = true)
      )
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Get latest message per conversation partner with unread count
    const conversations = await sql`
      WITH latest_messages AS (
        SELECT 
          CASE 
            WHEN sender_id = ${userId} THEN receiver_id
            ELSE sender_id
          END as other_user_id,
          message as last_message,
          created_at as last_message_time,
          machinery_id,
          read_at,
          ROW_NUMBER() OVER (
            PARTITION BY 
              CASE 
                WHEN sender_id = ${userId} THEN receiver_id
                ELSE sender_id
              END
            ORDER BY created_at DESC
          ) as rn
        FROM messages
        WHERE (sender_id = ${userId} AND deleted_by_sender = false)
           OR (receiver_id = ${userId} AND deleted_by_receiver = false)
      ),
      unread_counts AS (
        SELECT 
          sender_id as other_user_id,
          COUNT(*) as unread_count
        FROM messages
        WHERE receiver_id = ${userId} 
          AND read_at IS NULL 
          AND deleted_by_receiver = false
        GROUP BY sender_id
      )
      SELECT 
        lm.other_user_id,
        u.name,
        u.image,
        u.last_seen,
        lm.last_message,
        lm.last_message_time,
        lm.machinery_id,
        COALESCE(uc.unread_count, 0) as unread_count
      FROM latest_messages lm
      JOIN "user" u ON u.id = lm.other_user_id
      LEFT JOIN unread_counts uc ON uc.other_user_id = lm.other_user_id
      WHERE lm.rn = 1
      ORDER BY lm.last_message_time DESC
    `;

    // Get machinery details
    const machineryIds = conversations
      .map((c: any) => c.machinery_id)
      .filter(Boolean);

    let machineryMap: Record<string, any> = {};
    if (machineryIds.length > 0) {
      const machines = await sql`
        SELECT id, name, image_url 
        FROM machinery 
        WHERE id = ANY(${machineryIds})
      `;
      for (const m of machines) {
        machineryMap[m.id] = m;
      }
    }

    // Calculate online status
    const now = new Date().getTime();
    const result = conversations.map((conv: any) => ({
      ...conv,
      machinery_name: machineryMap[conv.machinery_id]?.name || '',
      machinery_image: machineryMap[conv.machinery_id]?.image_url || '',
      is_online: conv.last_seen 
        ? (now - new Date(conv.last_seen).getTime()) < ONLINE_THRESHOLD_MS 
        : false,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
