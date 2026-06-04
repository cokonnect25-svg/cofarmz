export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, otherUserId } = body;

    if (!userId || !otherUserId) {
      return NextResponse.json({ error: 'Missing userId or otherUserId' }, { status: 400 });
    }

    await sql`
      UPDATE messages 
      SET deleted_by_sender = CASE WHEN sender_id = ${userId} THEN true ELSE deleted_by_sender END,
          deleted_by_receiver = CASE WHEN receiver_id = ${userId} THEN true ELSE deleted_by_receiver END
      WHERE (sender_id = ${userId} AND receiver_id = ${otherUserId})
         OR (sender_id = ${otherUserId} AND receiver_id = ${userId})
    `;

    await sql`
      DELETE FROM messages 
      WHERE deleted_by_sender = true AND deleted_by_receiver = true
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
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  const conversations = await sql`
  SELECT 
    conv.other_user_id,
    u.name,
    u.image,
    conv.last_message,
    conv.last_message_time,
    conv.machinery_id,
    conv.unread_count,
    u.last_seen
  FROM (
    SELECT 
      other_user_id,
      MAX(created_at) as last_message_time,
      COUNT(*) FILTER (WHERE read_at IS NULL AND receiver_id = ${userId}) as unread_count,
      (ARRAY_AGG(message ORDER BY created_at DESC))[1] as last_message,
      (ARRAY_AGG(machinery_id ORDER BY created_at DESC))[1] as machinery_id
    FROM (
      SELECT 
        CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END as other_user_id,
        receiver_id,
        created_at,
        message,
        machinery_id,
        read_at
      FROM messages
      WHERE (sender_id = ${userId} OR receiver_id = ${userId})
        AND (
          (sender_id = ${userId} AND deleted_by_sender = false) OR
          (receiver_id = ${userId} AND deleted_by_receiver = false)
        )
    ) m
    GROUP BY other_user_id
  ) conv
  JOIN "user" u ON u.id = conv.other_user_id
  ORDER BY conv.last_message_time DESC
`;
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

    const now = new Date().getTime();
const result = conversations.map((conv: any) => {
  const machinery = conv.machinery_id ? machineryMap[conv.machinery_id] : null;
  return {
    ...conv,
    machinery_name: machinery?.name || '',      // from machinery table
    machinery_image: machinery?.image_url || '',   // from machinery table
    is_online: conv.last_seen 
      ? (now - new Date(conv.last_seen).getTime()) < ONLINE_THRESHOLD_MS 
      : false,
  };
});

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}