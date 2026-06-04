export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

// ── Supported message types ─────────────────────────────────
type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'location';

// ── GET: Fetch messages between two users ───────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const otherUserId = searchParams.get('otherUserId');

    if (!userId || !otherUserId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const messages = await sql`
      SELECT 
        id,
        sender_id,
        receiver_id,
        machinery_id,
        message,
        message_type,
        media_url,
        media_thumbnail,
        file_name,
        file_size,
        latitude,
        longitude,
        location_name,
        duration,
        created_at,
        read_at,
        deleted_by_sender,
        deleted_by_receiver
      FROM messages
      WHERE (
        (sender_id = ${userId} AND receiver_id = ${otherUserId} AND deleted_by_sender = false)
        OR
        (sender_id = ${otherUserId} AND receiver_id = ${userId} AND deleted_by_receiver = false)
      )
      ORDER BY created_at ASC
    `;

    return NextResponse.json(messages);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Send a new message (text, location, or media with pre-uploaded URL) ─
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      senderId,
      receiverId,
      machineryId,
      message,
      messageType = 'text',
      mediaUrl,
      mediaThumbnail,
      fileName,
      fileSize,
      latitude,
      longitude,
      locationName,
      duration,
    } = body;

    if (!senderId || !receiverId) {
      return NextResponse.json(
        { error: "Missing required fields: senderId and receiverId" },
        { status: 400 }
      );
    }

    // Validate message type
    const validTypes: MessageType[] = ['text', 'image', 'video', 'audio', 'file', 'location'];
    if (!validTypes.includes(messageType)) {
      return NextResponse.json(
        { error: `Invalid message type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Text messages require content
    if (messageType === 'text' && !message) {
      return NextResponse.json(
        { error: "Message content required for text type" },
        { status: 400 }
      );
    }

    // Media messages require media_url (pre-uploaded to R2 via /api/upload)
    if (['image', 'video', 'audio', 'file'].includes(messageType) && !mediaUrl) {
      return NextResponse.json(
        { error: "mediaUrl required. Upload file to /api/upload first" },
        { status: 400 }
      );
    }

    // Location messages require coordinates
    if (messageType === 'location' && (latitude == null || longitude == null)) {
      return NextResponse.json(
        { error: "latitude and longitude required for location messages" },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO messages (
        sender_id,
        receiver_id,
        machinery_id,
        message,
        message_type,
        media_url,
        media_thumbnail,
        file_name,
        file_size,
        latitude,
        longitude,
        location_name,
        duration
      ) VALUES (
        ${senderId},
        ${receiverId},
        ${machineryId || null},
        ${message || null},
        ${messageType},
        ${mediaUrl || null},
        ${mediaThumbnail || null},
        ${fileName || null},
        ${fileSize || null},
        ${latitude != null ? latitude : null},
        ${longitude != null ? longitude : null},
        ${locationName || null},
        ${duration || null}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error: any) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE: Delete a single message ───────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!messageId || !userId) {
      return NextResponse.json(
        { error: 'Missing message id or userId' },
        { status: 400 }
      );
    }

    const msg = await sql`
      SELECT sender_id, receiver_id, deleted_by_sender, deleted_by_receiver, media_url
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

    // Soft delete
    if (isSender) {
      await sql`
        UPDATE messages 
        SET deleted_by_sender = true 
        WHERE id = ${messageId}
      `;
    } else {
      await sql`
        UPDATE messages 
        SET deleted_by_receiver = true 
        WHERE id = ${messageId}
      `;
    }

    // Hard delete if both sides deleted
    const bothDeleted = await sql`
      SELECT deleted_by_sender, deleted_by_receiver 
      FROM messages WHERE id = ${messageId}
    `;

    if (bothDeleted[0]?.deleted_by_sender && bothDeleted[0]?.deleted_by_receiver) {
      // Optional: delete from R2 here if you want to clean up storage
      // await deleteFromR2(message.media_url);
      await sql`DELETE FROM messages WHERE id = ${messageId}`;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── PATCH: Mark messages as read ──────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, senderId } = body;

    if (!userId || !senderId) {
      return NextResponse.json(
        { error: 'Missing userId or senderId' },
        { status: 400 }
      );
    }

    await sql`
      UPDATE messages
      SET read_at = NOW()
      WHERE receiver_id = ${userId}
        AND sender_id = ${senderId}
        AND read_at IS NULL
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error marking as read:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE conversation: Delete all messages between two users ─
export async function deleteConversation(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, otherUserId } = body;

    if (!userId || !otherUserId) {
      return NextResponse.json(
        { error: 'Missing userId or otherUserId' },
        { status: 400 }
      );
    }

    // Soft delete for user's side
    await sql`
      UPDATE messages
      SET deleted_by_sender = CASE WHEN sender_id = ${userId} THEN true ELSE deleted_by_sender END,
          deleted_by_receiver = CASE WHEN receiver_id = ${userId} THEN true ELSE deleted_by_receiver END
      WHERE (sender_id = ${userId} AND receiver_id = ${otherUserId})
         OR (sender_id = ${otherUserId} AND receiver_id = ${userId})
    `;

    // Hard delete messages deleted by both
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