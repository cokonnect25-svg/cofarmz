import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Ensure views column exists
    await sql`ALTER TABLE reels ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0`.catch(() => {});

    // Increment view count
    await sql`
      UPDATE reels
      SET views = COALESCE(views, 0) + 1
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Increment view error:", error);
    return NextResponse.json(
      { error: "Failed to increment view" },
      { status: 500 }
    );
  }
}
