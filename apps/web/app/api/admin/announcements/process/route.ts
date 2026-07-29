export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";
import { sendPushToAllUsers } from "@/app/api/utils/push";

export async function POST(request: Request) {
  const configuredSecret = process.env.ANNOUNCEMENT_SCHEDULER_SECRET;
  const suppliedSecret = request.headers.get("x-scheduler-secret");

  if (!configuredSecret) {
    return NextResponse.json(
      { error: "ANNOUNCEMENT_SCHEDULER_SECRET is not configured" },
      { status: 503 }
    );
  }
  if (suppliedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ`;
    await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS repeat_interval_hours INTEGER`;
    await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS next_send_at TIMESTAMPTZ`;
    await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ`;
    await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS send_count INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`;

    const due = await sql.begin(async (transaction) => transaction`
      UPDATE announcements
      SET
        last_sent_at = NOW(),
        send_count = COALESCE(send_count, 0) + 1,
        next_send_at = CASE
          WHEN repeat_interval_hours IS NOT NULL
            AND (expires_at IS NULL OR NOW() + make_interval(hours => repeat_interval_hours) < expires_at)
          THEN NOW() + make_interval(hours => repeat_interval_hours)
          ELSE NULL
        END,
        is_active = CASE
          WHEN repeat_interval_hours IS NOT NULL
            AND (expires_at IS NULL OR NOW() + make_interval(hours => repeat_interval_hours) < expires_at)
          THEN TRUE
          ELSE FALSE
        END
      WHERE id IN (
        SELECT id
        FROM announcements
        WHERE is_active = TRUE
          AND next_send_at IS NOT NULL
          AND next_send_at <= NOW()
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY next_send_at
        FOR UPDATE SKIP LOCKED
        LIMIT 20
      )
      RETURNING *
    `);

    for (const announcement of due) {
      await sendPushToAllUsers({
        title: `Announcement: ${announcement.title}`,
        body: announcement.body.length > 120
          ? `${announcement.body.slice(0, 120)}...`
          : announcement.body,
        url: "/notifications",
        tag: `ann-${announcement.id}`,
        data: {
          type: "announcement",
          announcementId: announcement.id,
          deliveryNumber: announcement.send_count,
        },
      });
    }

    return NextResponse.json({ processed: due.length });
  } catch (error) {
    console.error("Announcement scheduler error:", error);
    return NextResponse.json({ error: "Scheduler processing failed" }, { status: 500 });
  }
}
