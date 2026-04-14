export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const otherUserId = searchParams.get("otherUserId");

  if (!userId || !otherUserId) {
    return NextResponse.json(
      { error: "Missing userId or otherUserId" },
      { status: 400 }
    );
  }

  const messages = await sql`
    SELECT * FROM messages 
    WHERE (sender_id = ${userId} AND receiver_id = ${otherUserId})
       OR (sender_id = ${otherUserId} AND receiver_id = ${userId})
    ORDER BY created_at ASC
  `;

  return NextResponse.json(messages);
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

