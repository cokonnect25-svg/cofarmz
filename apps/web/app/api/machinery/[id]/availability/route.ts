export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if equipment is globally unavailable
    const machinery = await sql`SELECT is_unavailable FROM machinery WHERE id = ${id}`;
    if (machinery.length > 0 && machinery[0].is_unavailable) {
      return NextResponse.json({
        machinery_id: id,
        globally_unavailable: true,
        booked_dates: [],
      });
    }

    // Get all confirmed/accepted reservations for this machinery
    const reservations = await sql`
      SELECT start_date, end_date, status
      FROM reservations
      WHERE machinery_id = ${id} AND (status = 'accepted' OR status = 'confirmed')
      ORDER BY start_date ASC
    `;

    // Get all blocked date ranges
    const blockedRanges = await sql`
      SELECT start_date, end_date
      FROM machinery_unavailability
      WHERE machinery_id = ${id} AND start_date IS NOT NULL AND end_date IS NOT NULL
      ORDER BY start_date ASC
    `;

    return NextResponse.json({
      machinery_id: id,
      globally_unavailable: false,
      booked_dates: [
        ...reservations.map((r: any) => ({
          start_date: r.start_date,
          end_date: r.end_date,
        })),
        ...blockedRanges.map((b: any) => ({
          start_date: b.start_date,
          end_date: b.end_date,
        })),
      ],
    });
  } catch (error) {
    console.error("Availability check error:", error);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { start_date, end_date } = await request.json();

    // Check if equipment is globally unavailable
    const machinery = await sql`SELECT is_unavailable FROM machinery WHERE id = ${id}`;
    if (machinery.length > 0 && machinery[0].is_unavailable) {
      return NextResponse.json({
        available: false,
        reason: "Equipment is marked as unavailable",
      });
    }

    // Check if dates overlap with existing confirmed bookings
    const overlappingBookings = await sql`
      SELECT id, start_date, end_date
      FROM reservations
      WHERE machinery_id = ${id} 
        AND (status = 'accepted' OR status = 'confirmed')
        AND (
          (${start_date}::date < end_date AND ${end_date}::date > start_date)
        )
    `;

    // Check if dates overlap with blocked date ranges
    const overlappingBlocked = await sql`
      SELECT id, start_date, end_date
      FROM machinery_unavailability
      WHERE machinery_id = ${id}
        AND start_date IS NOT NULL AND end_date IS NOT NULL
        AND (
          (${start_date}::date < end_date AND ${end_date}::date > start_date)
        )
    `;

    const isAvailable = overlappingBookings.length === 0 && overlappingBlocked.length === 0;

    return NextResponse.json({
      available: isAvailable,
      requested_dates: { start_date, end_date },
      conflicting_bookings: overlappingBookings.map((r: any) => ({
        start_date: r.start_date,
        end_date: r.end_date,
      })),
      blocked_dates: overlappingBlocked.map((b: any) => ({
        start_date: b.start_date,
        end_date: b.end_date,
      })),
    });
  } catch (error) {
    console.error("Availability check error:", error);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
