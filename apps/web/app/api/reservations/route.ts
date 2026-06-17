export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse, NextRequest } from "next/server";

async function recordReservationEvent(reservation: any) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS app_events (
        id BIGSERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        user_id TEXT,
        user_name TEXT,
        user_email TEXT,
        page_path TEXT,
        entity_type TEXT,
        entity_id TEXT,
        entity_name TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      INSERT INTO app_events (
        event_type, user_id, page_path, entity_type, entity_id, entity_name, metadata
      )
      VALUES (
        'reservation_created',
        ${reservation.user_id || null},
        '/machinery-details',
        'reservation',
        ${String(reservation.id)},
        ${reservation.machinery_name || null},
        ${sql.json({
          machinery_id: reservation.machinery_id,
          owner_id: reservation.owner_id,
          start_date: reservation.start_date,
          end_date: reservation.end_date,
          total_days: reservation.total_days,
          total_price: reservation.total_price,
          status: reservation.status,
        })}
      )
    `;
  } catch (error) {
    console.error("Failed to record reservation analytics:", error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('user_id');
    const ownerId = request.nextUrl.searchParams.get('owner_id');
    
    let reservations;
    if (userId) {
      reservations = await sql`
        SELECT r.*, 
               u.name  AS owner_name, 
               u.email AS owner_email, 
               u.image AS owner_image
        FROM reservations r
        LEFT JOIN "user" u ON r.owner_id = u.id
        WHERE r.user_id = ${userId} 
        ORDER BY r.created_at DESC
      `;
    } else if (ownerId) {
      // FIX: include renter_phone so the owner can call the renter from the rental card
      reservations = await sql`
        SELECT r.*, 
               u.name        AS renter_name, 
               u.email       AS renter_email, 
               u.image       AS renter_image,
               r.renter_phone                   -- always carry the phone the renter entered at booking
        FROM reservations r
        LEFT JOIN "user" u ON r.user_id = u.id
        WHERE r.owner_id = ${ownerId} 
        ORDER BY r.created_at DESC
      `;
    } else {
      reservations = await sql`SELECT * FROM reservations ORDER BY created_at DESC`;
    }
    
    return NextResponse.json(reservations);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("GET /api/reservations error:", errorMessage);
    return NextResponse.json({ error: "Failed to fetch reservations", details: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const {
      user_id, owner_id, machinery_id, machinery_name,
      start_date, end_date, total_days, daily_rate, total_price, renter_phone
    } = await request.json();

    if (!user_id || !owner_id || !machinery_id || !machinery_name || !start_date || !end_date || !total_days || !daily_rate || !total_price) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS renter_phone TEXT`.catch(() => {});

    const result = await sql`
      INSERT INTO reservations (
        user_id, owner_id, machinery_id, machinery_name,
        start_date, end_date, total_days, daily_rate, total_price,
        status, renter_phone
      )
      VALUES (
        ${user_id}, ${owner_id}, ${machinery_id}, ${machinery_name},
        ${start_date}, ${end_date}, ${total_days}, ${daily_rate}, ${total_price},
        'pending', ${renter_phone || null}
      )
      RETURNING *
    `;

    await recordReservationEvent(result[0]);

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Reservation error:", error);
    return NextResponse.json({ error: "Failed to create reservation" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!['pending', 'accepted', 'completed', 'cancelled', 'rejected'].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await sql`ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check`.catch(() => {});
    await sql`ALTER TABLE reservations ADD CONSTRAINT reservations_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed'))`.catch(() => {});

    const result = await sql`
      UPDATE reservations 
      SET 
        status     = ${status},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    return NextResponse.json(result[0], { status: 200 });
  } catch (error) {
    console.error("Update error:", error);
    return NextResponse.json({ error: "Failed to update reservation" }, { status: 500 });
  }
}
