export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const currentUserId = searchParams.get("currentUserId");

    let farmers;
    if (currentUserId) {
      farmers = await sql`
        SELECT
          u.id, u.name, u.image, u.location,
          COALESCE(
            (SELECT array_agg(DISTINCT c.crop_name) FROM crops c WHERE c.user_id = u.id),
            ARRAY[]::text[]
          ) as crops,
          (SELECT COUNT(*) FROM machinery WHERE owner_id = u.id) as equipments_count
        FROM "user" u
        WHERE u.role = 'farmer' AND u.id != ${currentUserId}
        ORDER BY u.name ASC
      `;
    } else {
      farmers = await sql`
        SELECT
          u.id, u.name, u.image, u.location,
          COALESCE(
            (SELECT array_agg(DISTINCT c.crop_name) FROM crops c WHERE c.user_id = u.id),
            ARRAY[]::text[]
          ) as crops,
          (SELECT COUNT(*) FROM machinery WHERE owner_id = u.id) as equipments_count
        FROM "user" u
        WHERE u.role = 'farmer'
        ORDER BY u.name ASC
      `;
    }

    return NextResponse.json(farmers);
  } catch (error) {
    console.error("Get farmers error:", error);
    return NextResponse.json(
      { error: "Failed to get farmers" },
      { status: 500 }
    );
  }
}

