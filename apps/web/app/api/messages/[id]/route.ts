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

    let userId: string;
    try {
      const body = await req.json();
      userId = body.userId;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (isNaN(messageId) || !userId) {
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

    // Determine who is deleting
    let updateField: string;
    if (message.sender_id === userId) {
      updateField = 'deleted_by_sender';
    } else if (message.receiver_id === userId) {
      updateField = 'deleted_by_receiver';
    } else {
      return NextResponse.json({ error: 'Unauthorized — not sender or receiver' }, { status: 403 });
    }

    // Check if other side already deleted
    const otherDeleted = updateField === 'deleted_by_sender' 
      ? message.deleted_by_receiver 
      : message.deleted_by_sender;

    if (otherDeleted) {
      // Hard delete if both sides deleted
      await sql`DELETE FROM messages WHERE id = ${messageId}`;
    } else {
      // ✅ FIXED: Use sql.unsafe for dynamic column names
      // sql`` template literal CANNOT have dynamic column names
// ✅ BEST: Use sql() helper for the column identifier
await sql`
  UPDATE messages 
  SET ${sql(updateField)} = true 
  WHERE id = ${messageId}
`;
    }

    return NextResponse.json({ success: true, hardDelete: !!otherDeleted });
  } catch (error: any) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}