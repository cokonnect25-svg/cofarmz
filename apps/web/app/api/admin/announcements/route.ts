export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { deliverAnnouncement } from "@/lib/fpo-announcements";
import { requireActor, fpoError, FpoError } from '@/lib/fpo-access';

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

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await ensureAnnouncementScheduleColumns();
    const rows = await sql`
      SELECT * FROM announcements
      WHERE (expires_at IS NULL OR expires_at > NOW()) AND (group_id IS NULL OR can_receive_fpo_message(${actor.id},group_id)) AND (scheduled_at IS NULL OR scheduled_at<=now())
      ORDER BY created_at DESC
      LIMIT 20
    `;
    return NextResponse.json(rows);
  } catch (error) {
    return fpoError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request,true);
    await ensureAnnouncementScheduleColumns();
    const { title, body, expiresAt, scheduledAt, repeatIntervalHours, groupId = null } = await request.json();
    const createdBy = actor.id;
    if (groupId) {
      if (!/^[0-9a-f-]{36}$/i.test(groupId)) throw new FpoError('Invalid group');
      const [group] = await sql`SELECT g.id FROM farmer_groups g JOIN digital_fpos f ON f.id=g.digital_fpo_id WHERE g.id=${groupId} AND f.status='active'`;
      if (!group) throw new FpoError('Active group required');
    }
    if (typeof title !== 'string' || typeof body !== 'string' || title.length>200 || body.length>10000) throw new FpoError('Invalid announcement');
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
    // Immediate deliveries also start as due. They are advanced only after
    // FCM accepts at least one notification, so transient failures can retry.
    const nextSendAt = sendImmediately ? new Date() : scheduledDate;

    const result = await sql`
      INSERT INTO announcements (
        group_id, title, body, created_by, expires_at, scheduled_at, repeat_interval_hours,
        next_send_at, last_sent_at, send_count, is_active
      )
      VALUES (
        ${groupId},
        ${title},
        ${body},
        ${createdBy},
        ${expiresDate},
        ${scheduledDate},
        ${repeatHours},
        ${nextSendAt},
        ${null},
        0,
        TRUE
      )
      RETURNING *
    `;

    let sentImmediately = false;
    let pushDelivery = null;
    if (sendImmediately) {
      pushDelivery = await deliverAnnouncement(groupId, {
        title: `Announcement: ${title}`,
        body: body.length > 120 ? `${body.slice(0, 120)}...` : body,
        url: `/notifications?announcement=${encodeURIComponent(String(result[0].id))}`,
        tag: `ann-${result[0].id}-delivery-1`,
        data: {
          type: "announcement",
          announcementId: result[0].id,
          deliveryNumber: 1,
        },
      });

      if (pushDelivery.succeeded > 0) {
        sentImmediately = true;
        const nextRepeatAt = repeatHours
          ? new Date(Date.now() + repeatHours * 60 * 60 * 1000)
          : null;
        await sql`
          UPDATE announcements
          SET last_sent_at = NOW(),
              send_count = 1,
              next_send_at = ${nextRepeatAt},
              is_active = ${Boolean(nextRepeatAt)}
          WHERE id = ${result[0].id}
        `;
      }
    }

    return NextResponse.json(
      {
        ...result[0],
        sentImmediately,
        pushDelivery,
        deliveryPending: sendImmediately && !sentImmediately,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create announcement error:", error);
    return fpoError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireActor(request,true);
    const { id } = await request.json();
    await sql`DELETE FROM announcements WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return fpoError(error);
  }
}
