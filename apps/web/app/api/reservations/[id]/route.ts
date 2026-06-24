export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { sendPushToUser } from "@/app/api/utils/push";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = await request.json();

    const result = await sql`
      UPDATE reservations SET status = ${status}, updated_at = NOW() WHERE id = ${id} RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    const statusLabels: Record<string, string> = {
      accepted: "confirmed",
      rejected: "declined",
      cancelled: "cancelled",
      completed: "completed",
    };

    await sendPushToUser(result[0].user_id, {
      title: `Booking ${statusLabels[status] || status}`,
      body: `Your booking for ${result[0].machinery_name} was ${statusLabels[status] || status}`,
      url: "/my-reservations",
      tag: `booking-update-${result[0].id}`,
      data: {
        type: "booking_update",
        reservationId: result[0].id,
        status,
      },
    });

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating reservation:", error);
    return NextResponse.json({ error: "Failed to update reservation" }, { status: 500 });
  }
}
