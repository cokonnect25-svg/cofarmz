export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const machinery = await sql`
      SELECT
        id,
        name,
        model,
        daily_rate,
        image_url,
        location,
        year,
        is_unavailable,
        ROUND(RANDOM() * 50)::INT as distance
      FROM machinery
      ORDER BY created_at DESC
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

