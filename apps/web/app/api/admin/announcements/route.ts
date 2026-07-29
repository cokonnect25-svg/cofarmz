export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { sendPushToAllUsers } from "@/app/api/utils/push";

const ALLOWED_REPEAT_HOURS = new Set([1, 3, 6, 12]);

async function ensureAnnouncementScheduleColumns() {
  await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ`;
  await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS repeat_interval_hours INTEGER`;
  await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS next_send_at TIMESTAMPTZ`;
  await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ`;
  await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS send_count INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`CREATE INDEX IF NOT EXISTS idx_announcements_next_send ON announcements(next_send_at) WHERE is_active = TRUE`;
}

export async function GET() {
  try {
    await ensureAnnouncementScheduleColumns();
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
    await ensureAnnouncementScheduleColumns();
    const { title, body, createdBy, expiresAt, scheduledAt, repeatIntervalHours } = await request.json();
    if (!title || !body || !createdBy) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const repeatHours = repeatIntervalHours === null || repeatIntervalHours === undefined
      ? null
      : Number(repeatIntervalHours);
    if (repeatHours !== null && !ALLOWED_REPEAT_HOURS.has(repeatHours)) {
      return NextResponse.json({ error: "Frequency must be 1, 3, 6, or 12 hours" }, { status: 400 });
    }

    const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
    const expiresDate = expiresAt ? new Date(expiresAt) : null;
    if (scheduledDate && Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: "Invalid scheduled date" }, { status: 400 });
    }
    if (expiresDate && Number.isNaN(expiresDate.getTime())) {
      return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
    }
    if (expiresDate && expiresDate <= new Date()) {
      return NextResponse.json({ error: "Expiry must be in the future" }, { status: 400 });
    }
    if (scheduledDate && expiresDate && expiresDate <= scheduledDate) {
      return NextResponse.json({ error: "Expiry must be after the scheduled start" }, { status: 400 });
    }

    const sendImmediately = !scheduledDate || scheduledDate <= new Date();
    const nextSendAt = sendImmediately
      ? (repeatHours ? new Date(Date.now() + repeatHours * 60 * 60 * 1000) : null)
      : scheduledDate;

    const result = await sql`
      INSERT INTO announcements (
        title, body, created_by, expires_at, scheduled_at, repeat_interval_hours,
        next_send_at, last_sent_at, send_count, is_active
      )
      VALUES (
        ${title},
        ${body},
        ${createdBy},
        ${expiresDate},
        ${scheduledDate},
        ${repeatHours},
        ${nextSendAt},
        ${sendImmediately ? new Date() : null},
        ${sendImmediately ? 1 : 0},
        TRUE
      )
      RETURNING *
    `;

    if (sendImmediately) {
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
    }

    return NextResponse.json({ ...result[0], sentImmediately: sendImmediately }, { status: 201 });
  } catch (error) {
    console.error("Create announcement error:", error);
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
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
