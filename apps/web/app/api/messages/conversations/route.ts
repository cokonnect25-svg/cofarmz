export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

export async function DELETE(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const userId = req.nextUrl.searchParams.get('userId') || req.headers.get('x-user-id') || body.userId;
    const otherUserId = req.nextUrl.searchParams.get('otherUserId') || body.otherUserId;

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
    const wantsPagination = searchParams.has('limit') || searchParams.has('offset');
    const rawLimit = Number(searchParams.get('limit') || 10);
    const rawOffset = Number(searchParams.get('offset') || 0);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 10, 1), 25);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

  const conversations = await sql`
    WITH visible_messages AS (
      SELECT
        receiver_id AS other_user_id,
        sender_id,
        receiver_id,
        created_at,
        message,
        machinery_id,
        read_at
      FROM messages
      WHERE sender_id = ${userId}
        AND deleted_by_sender IS NOT TRUE

      UNION ALL

      SELECT
        sender_id AS other_user_id,
        sender_id,
        receiver_id,
        created_at,
        message,
        machinery_id,
        read_at
      FROM messages
      WHERE receiver_id = ${userId}
        AND deleted_by_receiver IS NOT TRUE
    ),
    ranked AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY other_user_id
          ORDER BY created_at DESC, sender_id DESC
        ) AS rn,
        COUNT(*) FILTER (
          WHERE read_at IS NULL AND receiver_id = ${userId}
        ) OVER (PARTITION BY other_user_id) AS unread_count
      FROM visible_messages
    )
    SELECT
      r.other_user_id,
      u.name,
      u.image,
      r.message AS last_message,
      r.created_at AS last_message_time,
      r.sender_id AS last_message_sender_id,
      r.receiver_id AS last_message_receiver_id,
      r.read_at AS last_message_read_at,
      r.machinery_id,
      r.unread_count,
      u.last_seen
    FROM ranked r
    JOIN "user" u ON u.id = r.other_user_id
    WHERE r.rn = 1
    ORDER BY r.created_at DESC
    LIMIT ${limit + 1}
    OFFSET ${offset}
  `;
    const hasMore = conversations.length > limit;
    const pageConversations = hasMore ? conversations.slice(0, limit) : conversations;
    const machineryIds = pageConversations
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
const result = pageConversations.map((conv: any) => {
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

    if (!wantsPagination) return NextResponse.json(result);

    return NextResponse.json({
      data: result,
      pagination: {
        limit,
        offset,
        nextOffset: offset + result.length,
        hasMore,
      },
    });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
