export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const otherUserId = searchParams.get('otherUserId');

    if (!userId || !otherUserId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const messages = await sql`
      SELECT * FROM messages
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

export async function POST(request: Request) {
  const { senderId, receiverId, machineryId, message } = await request.json();

  if (!senderId || !receiverId || !message) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const result = await sql`
    INSERT INTO messages (sender_id, receiver_id, machinery_id, message)
    VALUES (${senderId}, ${receiverId}, ${machineryId}, ${message})
    RETURNING *
  `;

  return NextResponse.json(result[0]);
}

