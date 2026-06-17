export const dynamic = 'force-dynamic';

import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messageId = Number.parseInt(id, 10);

    let bodyUserId: string | undefined;
    try {
      const body = await req.json();
      bodyUserId = body?.userId;
    } catch {
      bodyUserId = undefined;
    }

    const userId =
      req.nextUrl.searchParams.get("userId") ||
      req.headers.get("x-user-id") ||
      bodyUserId;

    if (!Number.isFinite(messageId) || !userId) {
      return NextResponse.json({ error: "Missing messageId or userId" }, { status: 400 });
    }

    const [message] = await sql`
      SELECT sender_id, receiver_id, deleted_by_sender, deleted_by_receiver
      FROM messages
      WHERE id = ${messageId}
    `;

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (message.sender_id === userId) {
      if (message.deleted_by_receiver) {
        await sql`DELETE FROM messages WHERE id = ${messageId}`;
      } else {
        await sql`UPDATE messages SET deleted_by_sender = true WHERE id = ${messageId}`;
      }
    } else if (message.receiver_id === userId) {
      if (message.deleted_by_sender) {
        await sql`DELETE FROM messages WHERE id = ${messageId}`;
      } else {
        await sql`UPDATE messages SET deleted_by_receiver = true WHERE id = ${messageId}`;
      }
    } else {
      return NextResponse.json({ error: "Unauthorized - not sender or receiver" }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting message:", error);
    return NextResponse.json({ error: error.message || "Failed to delete message" }, { status: 500 });
  }
}
