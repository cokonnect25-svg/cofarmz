export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Cancel all pending reservations created more than 2 days ago
    const result = await sql`
      UPDATE reservations
      SET status = 'cancelled'
      WHERE status = 'pending'
        AND created_at < NOW() - INTERVAL '2 days'
      RETURNING id, machinery_name
    `;

    return NextResponse.json({
      cancelled: result.length,
      items: result,
    });
  } catch (error) {
    console.error("Auto-cancel error:", error);
    return NextResponse.json({ error: "Failed to auto-cancel" }, { status: 500 });
  }
}

