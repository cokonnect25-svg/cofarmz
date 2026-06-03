// ============================================================
// 2. DELETE /api/messages/[id]/route.ts
// Soft-delete a message
// ============================================================
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
    const { userId } = await req.json();

    if (!messageId || !userId) {
      return NextResponse.json({ error: 'Missing messageId or userId' }, { status: 400 });
    }

    // Get the message
    const [message] = await sql`
      SELECT sender_id, receiver_id, deleted_by_sender, deleted_by_receiver 
      FROM messages 
      WHERE id = ${messageId}
    `;

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Determine which field to update
    let updateField = '';
    if (message.sender_id === userId) {
      updateField = 'deleted_by_sender';
    } else if (message.receiver_id === userId) {
      updateField = 'deleted_by_receiver';
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if both sides have deleted
    const otherDeleted = updateField === 'deleted_by_sender' 
      ? message.deleted_by_receiver 
      : message.deleted_by_sender;

    if (otherDeleted) {
      // Hard delete if both sides deleted
      await sql`DELETE FROM messages WHERE id = ${messageId}`;
    } else {
      // Soft delete
      await sql`
        UPDATE messages 
        SET ${sql(updateField)} = true
        WHERE id = ${messageId}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}