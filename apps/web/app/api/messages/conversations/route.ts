export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "Missing userId" },
      { status: 400 }
    );
  }

  try {
    // Get all unique conversations for the user (both as sender and receiver)
    const conversations = await sql`
      WITH latest_messages AS (
        SELECT 
          CASE 
            WHEN sender_id = ${userId} THEN receiver_id
            ELSE sender_id
          END as other_user_id,
          COALESCE(machinery_id, 'no_machinery') as machinery_key,
          machinery_id,
          message as last_message,
          created_at as last_message_time,
          ROW_NUMBER() OVER (
            PARTITION BY 
              CASE 
                WHEN sender_id = ${userId} THEN receiver_id
                ELSE sender_id
              END,
              COALESCE(machinery_id, 'no_machinery')
            ORDER BY created_at DESC
          ) as rn
        FROM messages
        WHERE sender_id = ${userId} OR receiver_id = ${userId}
      )
      SELECT 
        lm.other_user_id,
        u.name,
        u.image,
        lm.last_message,
        lm.last_message_time,
        lm.machinery_id,
        COALESCE(m.name, '') as machinery_name,
        COALESCE(m.image_url, '') as machinery_image
      FROM latest_messages lm
      JOIN "user" u ON u.id = lm.other_user_id
      LEFT JOIN machinery m ON m.id = lm.machinery_id AND m.id IS NOT NULL
      WHERE lm.rn = 1
      ORDER BY lm.last_message_time DESC
    `;

    return NextResponse.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

