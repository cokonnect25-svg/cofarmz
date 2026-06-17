export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'location';

async function recordMessageContact(message: any) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS app_events (
        id BIGSERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        user_id TEXT,
        user_name TEXT,
        user_email TEXT,
        page_path TEXT,
        entity_type TEXT,
        entity_id TEXT,
        entity_name TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const users = await sql`
      SELECT id, name, email
      FROM "user"
      WHERE id IN (${message.sender_id}, ${message.receiver_id})
    `;
    const sender = users.find((u: any) => u.id === message.sender_id);
    const receiver = users.find((u: any) => u.id === message.receiver_id);

    await sql`
      INSERT INTO app_events (
        event_type, user_id, user_name, user_email, page_path,
        entity_type, entity_id, entity_name, metadata
      )
      VALUES (
        'message_contact',
        ${message.sender_id},
        ${sender?.name || null},
        ${sender?.email || null},
        '/messages',
        'user',
        ${message.receiver_id},
        ${receiver?.name || null},
        ${sql.json({
          receiver_id: message.receiver_id,
          receiver_name: receiver?.name || null,
          receiver_email: receiver?.email || null,
          machinery_id: message.machinery_id || null,
          message_id: message.id,
          message_type: message.message_type,
        })}
      )
    `;
  } catch (error) {
    console.error("Failed to record message contact analytics:", error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const otherUserId = searchParams.get('otherUserId');
    if (!userId || !otherUserId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    const messages = await sql`
      SELECT id, sender_id, receiver_id, machinery_id, message,
        message_type, media_url, media_thumbnail, file_name, file_size,
        latitude, longitude, location_name, duration, created_at, read_at
      FROM messages
      WHERE (
        (sender_id = ${userId} AND receiver_id = ${otherUserId} AND deleted_by_sender IS NOT TRUE)
        OR
        (sender_id = ${otherUserId} AND receiver_id = ${userId} AND deleted_by_receiver IS NOT TRUE)
      )
      ORDER BY created_at ASC
    `;
    return NextResponse.json(messages);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      senderId, receiverId, machineryId, message,
      messageType, message_type, mediaUrl, media_url,
      mediaThumbnail, media_thumbnail, fileName, file_name,
      fileSize, file_size, latitude, longitude,
      locationName, location_name, duration,
    } = body;

    const finalMessageType: MessageType = (messageType || message_type || 'text') as MessageType;
    const finalMediaUrl = mediaUrl || media_url || null;
    const finalMediaThumbnail = mediaThumbnail || media_thumbnail || null;
    const finalFileName = fileName || file_name || null;
    const finalFileSize = fileSize || file_size || null;
    const finalLocationName = locationName || location_name || null;

    if (!senderId || !receiverId) {
      return NextResponse.json({ error: "Missing senderId and receiverId" }, { status: 400 });
    }

    const validTypes: MessageType[] = ['text', 'image', 'video', 'audio', 'file', 'location'];
    if (!validTypes.includes(finalMessageType)) {
      return NextResponse.json({ error: `Invalid message type` }, { status: 400 });
    }

    if (finalMessageType === 'text' && !message) {
      return NextResponse.json({ error: "Message content required" }, { status: 400 });
    }

    if (['image', 'video', 'audio', 'file'].includes(finalMessageType) && !finalMediaUrl) {
      return NextResponse.json({ error: "mediaUrl required" }, { status: 400 });
    }

    if (finalMessageType === 'location' && (latitude == null || longitude == null)) {
      return NextResponse.json({ error: "latitude and longitude required" }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO messages (
        sender_id, receiver_id, machinery_id, message, message_type,
        media_url, media_thumbnail, file_name, file_size,
        latitude, longitude, location_name, duration
      ) VALUES (
        ${senderId}, ${receiverId}, ${machineryId || null}, ${message || ''},
        ${finalMessageType}, ${finalMediaUrl}, ${finalMediaThumbnail},
        ${finalFileName}, ${finalFileSize},
        ${latitude != null ? latitude : null},
        ${longitude != null ? String(longitude) : null},
        ${finalLocationName}, ${duration || null}
      )
      RETURNING *
    `;
    await recordMessageContact(result[0]);
    return NextResponse.json(result[0]);
  } catch (error: any) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('id');
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const userId = searchParams.get('userId') || req.headers.get('x-user-id') || body.userId;
    const otherUserId = searchParams.get('otherUserId') || body.otherUserId;

    if (!messageId && userId && otherUserId) {
      await sql`
        UPDATE messages
        SET deleted_by_sender = CASE WHEN sender_id = ${userId} THEN true ELSE deleted_by_sender END,
            deleted_by_receiver = CASE WHEN receiver_id = ${userId} THEN true ELSE deleted_by_receiver END
        WHERE (sender_id = ${userId} AND receiver_id = ${otherUserId})
           OR (sender_id = ${otherUserId} AND receiver_id = ${userId})
      `;
      await sql`DELETE FROM messages WHERE deleted_by_sender = true AND deleted_by_receiver = true`;
      return NextResponse.json({ success: true, deleted: 'conversation' });
    }

    if (!messageId || !userId) {
      return NextResponse.json({ error: 'Missing message id or userId' }, { status: 400 });
    }

    const msg = await sql`
      SELECT sender_id, receiver_id, deleted_by_sender, deleted_by_receiver
      FROM messages WHERE id = ${messageId}
    `;
    if (msg.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const message = msg[0];
    const isSender = message.sender_id === userId;
    const isReceiver = message.receiver_id === userId;
    if (!isSender && !isReceiver) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (isSender) {
      await sql`UPDATE messages SET deleted_by_sender = true WHERE id = ${messageId}`;
    } else {
      await sql`UPDATE messages SET deleted_by_receiver = true WHERE id = ${messageId}`;
    }

    const bothDeleted = await sql`
      SELECT deleted_by_sender, deleted_by_receiver FROM messages WHERE id = ${messageId}
    `;
    if (bothDeleted[0]?.deleted_by_sender && bothDeleted[0]?.deleted_by_receiver) {
      await sql`DELETE FROM messages WHERE id = ${messageId}`;
    }
    return NextResponse.json({ success: true, deleted: 'message' });
  } catch (error: any) {
    console.error('Error deleting:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, senderId } = body;
    if (!userId || !senderId) {
      return NextResponse.json({ error: 'Missing userId or senderId' }, { status: 400 });
    }
    await sql`
      UPDATE messages SET read_at = NOW()
      WHERE receiver_id = ${userId} AND sender_id = ${senderId} AND read_at IS NULL
    `;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error marking as read:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
