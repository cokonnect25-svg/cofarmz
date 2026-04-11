import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get machinery
    const machinery = await sql`SELECT * FROM machinery WHERE id = ${id}`;
    if (!machinery || machinery.length === 0) {
      return NextResponse.json({ error: "Machinery not found" }, { status: 404 });
    }

    // Get unavailability records
    const unavailability = await sql`
      SELECT * FROM machinery_unavailability 
      WHERE machinery_id = ${id}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      machinery: machinery[0],
      unavailability: unavailability || [],
      is_globally_unavailable: machinery[0]?.is_unavailable || false,
    });
  } catch (error: any) {
    console.error("Error fetching unavailability:", error);
    return NextResponse.json(
      { error: "Failed to fetch unavailability", details: error?.message },
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
    const { start_date, end_date, is_globally_unavailable, reason, owner_id } = await request.json();

    // Verify owner
    const machinery = await sql`SELECT owner_id FROM machinery WHERE id = ${id}`;
    if (!machinery || machinery.length === 0) {
      return NextResponse.json({ error: "Machinery not found" }, { status: 404 });
    }

    if (machinery[0].owner_id !== owner_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // If marking as globally unavailable
    if (is_globally_unavailable) {
      const result = await sql`
        UPDATE machinery 
        SET is_unavailable = true
        WHERE id = ${id}
        RETURNING *
      `;

      // Also insert a record for tracking
      await sql`
        INSERT INTO machinery_unavailability (machinery_id, owner_id, is_globally_unavailable, reason)
        VALUES (${id}, ${owner_id}, true, ${reason || "Equipment marked as unavailable"})
      `;

      return NextResponse.json(result[0], { status: 201 });
    }

    // If blocking specific dates
    if (start_date && end_date) {
      const result = await sql`
        INSERT INTO machinery_unavailability (machinery_id, owner_id, start_date, end_date, reason)
        VALUES (${id}, ${owner_id}, ${start_date}, ${end_date}, ${reason || "Blocked dates"})
        RETURNING *
      `;
      return NextResponse.json(result[0], { status: 201 });
    }

    return NextResponse.json(
      { error: "Must provide either is_globally_unavailable or date range" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error creating unavailability:", error);
    return NextResponse.json(
      { error: "Failed to create unavailability", details: error?.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { is_unavailable, owner_id } = await request.json();

    // Verify owner
    const machinery = await sql`SELECT owner_id FROM machinery WHERE id = ${id}`;
    if (!machinery || machinery.length === 0) {
      return NextResponse.json({ error: "Machinery not found" }, { status: 404 });
    }

    if (machinery[0].owner_id !== owner_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await sql`
      UPDATE machinery 
      SET is_unavailable = ${is_unavailable}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 200 });
  } catch (error: any) {
    console.error("Error updating unavailability:", error);
    return NextResponse.json(
      { error: "Failed to update unavailability", details: error?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { unavailability_id, owner_id } = await request.json();

    // Verify owner
    const machinery = await sql`SELECT owner_id FROM machinery WHERE id = ${id}`;
    if (!machinery || machinery.length === 0) {
      return NextResponse.json({ error: "Machinery not found" }, { status: 404 });
    }

    if (machinery[0].owner_id !== owner_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete unavailability record
    const result = await sql`
      DELETE FROM machinery_unavailability 
      WHERE id = ${unavailability_id} AND machinery_id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Unavailability record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: result[0] }, { status: 200 });
  } catch (error: any) {
    console.error("Error deleting unavailability:", error);
    return NextResponse.json(
      { error: "Failed to delete unavailability", details: error?.message },
      { status: 500 }
    );
  }
}
