export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const since = searchParams.get("since"); // ISO timestamp

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const sinceDate = since ? new Date(since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    // 1. New messages received by this user
    const newMessages = await sql`
      SELECT
        m.id,
        m.message,
        m.created_at,
        m.sender_id,
        u.name as sender_name,
        u.image as sender_image,
        m.machinery_id
      FROM messages m
      JOIN "user" u ON u.id = m.sender_id
      WHERE m.receiver_id = ${userId}
        AND m.sender_id != ${userId}
        AND m.created_at > ${sinceDate}
      ORDER BY m.created_at DESC
      LIMIT 20
    `;

    // 2. New booking requests (owner gets notified when someone books their equipment)
    const newBookings = await sql`
      SELECT
        r.id,
        r.machinery_name,
        r.status,
        r.created_at,
        r.user_id,
        u.name as renter_name,
        u.image as renter_image
      FROM reservations r
      JOIN "user" u ON u.id = r.user_id
      WHERE r.owner_id = ${userId}
        AND r.status = 'pending'
        AND r.created_at > ${sinceDate}
      ORDER BY r.created_at DESC
      LIMIT 10
    `;

    // 3. Booking status changes (renter gets notified when owner accepts/rejects)
    const bookingUpdates = await sql`
      SELECT
        r.id,
        r.machinery_name,
        r.status,
        r.created_at,
        r.owner_id,
        u.name as owner_name,
        u.image as owner_image
      FROM reservations r
      JOIN "user" u ON u.id = r.owner_id
      WHERE r.user_id = ${userId}
        AND r.status IN ('accepted', 'rejected', 'cancelled', 'completed')
        AND r.created_at > ${sinceDate}
      ORDER BY r.created_at DESC
      LIMIT 10
    `;

    // 4. Equipment availability changes (notify followers or renters)
    const equipmentChanges = await sql`
      SELECT
        m.id,
        m.name,
        m.is_unavailable,
        m.updated_at,
        m.owner_id,
        u.name as owner_name
      FROM machinery m
      JOIN "user" u ON u.id = m.owner_id
      WHERE m.owner_id = ${userId}
        AND m.updated_at > ${sinceDate}
      ORDER BY m.updated_at DESC
      LIMIT 10
    `.catch(() => []);

    const notifications: any[] = [];

    newMessages.forEach((msg: any) => {
      notifications.push({
        id: `msg-${msg.id}`,
        type: 'message',
        title: msg.sender_name,
        body: msg.message.length > 60 ? msg.message.substring(0, 60) + '...' : msg.message,
        image: msg.sender_image,
        time: msg.created_at,
        link: `/chat?userId=${msg.sender_id}`,
      });
    });

    newBookings.forEach((booking: any) => {
      notifications.push({
        id: `booking-new-${booking.id}`,
        type: 'booking_new',
        title: 'New Booking Request',
        body: `${booking.renter_name} wants to book ${booking.machinery_name}`,
        image: booking.renter_image,
        time: booking.created_at,
        link: `/user-profile`,
      });
    });

    bookingUpdates.forEach((booking: any) => {
      const statusLabels: Record<string, string> = {
        accepted: 'confirmed',
        rejected: 'declined',
        cancelled: 'cancelled',
        completed: 'completed',
      };
      const statusLabel = statusLabels[booking.status] || booking.status;
      notifications.push({
        id: `booking-update-${booking.id}`,
        type: 'booking_update',
        title: `Booking ${statusLabel}`,
        body: `Your booking for ${booking.machinery_name} was ${statusLabel}`,
        image: booking.owner_image,
        time: booking.created_at,
        link: `/user-profile`,
        status: booking.status,
      });
    });

    equipmentChanges.forEach((eq: any) => {
      if (!eq.updated_at || new Date(eq.updated_at) <= sinceDate) return;
      notifications.push({
        id: `equip-${eq.id}`,
        type: 'equipment',
        title: 'Equipment Status Changed',
        body: `${eq.name} is now ${eq.is_unavailable ? 'unavailable' : 'available'}`,
        image: null,
        time: eq.updated_at,
        link: `/machinery-details?id=${eq.id}`,
        available: !eq.is_unavailable,
      });
    });

    // Sort by time descending
    notifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return NextResponse.json({
      notifications: notifications.slice(0, 30),
      unreadCount: notifications.length,
    });
  } catch (error) {
    console.error("Notifications error:", error);
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
}
