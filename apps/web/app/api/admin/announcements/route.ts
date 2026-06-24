export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { sendPushToAllUsers } from "@/app/api/utils/push";

export async function GET() {
  try {
    const rows = await sql`
      SELECT * FROM announcements
      WHERE expires_at IS NULL OR expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 20
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title, body, createdBy, expiresAt } = await request.json();
    if (!title || !body || !createdBy) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const result = await sql`
      INSERT INTO announcements (title, body, created_by, expires_at)
      VALUES (
        ${title},
        ${body},
        ${createdBy},
        ${expiresAt ? new Date(expiresAt) : null}
      )
      RETURNING *
    `;

    await sendPushToAllUsers({
      title: `Announcement: ${title}`,
      body: body.length > 120 ? `${body.slice(0, 120)}...` : body,
      url: "/notifications",
      tag: `ann-${result[0].id}`,
      data: {
        type: "announcement",
        announcementId: result[0].id,
      },
    });

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    await sql`DELETE FROM announcements WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
