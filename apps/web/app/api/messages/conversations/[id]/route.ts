// app/api/messages/conversation/[id]/route.ts
export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messageId = parseInt(id);
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (isNaN(messageId) || !userId) {
      return NextResponse.json({ error: 'Missing messageId or userId' }, { status: 400 });
    }

    const [message] = await sql`
      SELECT sender_id, receiver_id, deleted_by_sender, deleted_by_receiver 
      FROM messages WHERE id = ${messageId}
    `;

    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    let updateField: string;
    if (message.sender_id === userId) updateField = 'deleted_by_sender';
    else if (message.receiver_id === userId) updateField = 'deleted_by_receiver';
    else return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const otherDeleted = updateField === 'deleted_by_sender' 
      ? message.deleted_by_receiver 
      : message.deleted_by_sender;

    if (otherDeleted) {
      await sql`DELETE FROM messages WHERE id = ${messageId}`;
    } else {
      await sql`
        UPDATE messages 
        SET ${sql(updateField)} = true 
        WHERE id = ${messageId}
      `;
    }

    return NextResponse.json({ success: true, hardDelete: !!otherDeleted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}