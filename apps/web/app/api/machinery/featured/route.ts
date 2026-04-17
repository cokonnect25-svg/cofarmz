export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const machinery = await sql`
      SELECT
        m.id,
        m.name,
        m.model,
        m.daily_rate,
        m.image_url,
        m.location,
        m.year,
        m.is_unavailable,
        ROUND(RANDOM() * 50)::INT as distance,
        ROUND(COALESCE(AVG(r.rating), 0)::NUMERIC, 1) as avg_rating,
        COUNT(r.id)::INT as review_count
      FROM machinery m
      LEFT JOIN reviews r ON r.machinery_id = m.id
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT 10
    `;

    if (!machinery || !Array.isArray(machinery)) {
      console.error("Invalid machinery response:", machinery);
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(machinery);
  } catch (error: any) {
    console.error("Error fetching featured machinery:", error);
    return NextResponse.json(
      { error: "Failed to fetch machinery", details: error?.message },
      { status: 500 }
    );
  }
}

