import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing reel ID" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Missing user ID" },
        { status: 401 }
      );
    }

    // Verify the reel belongs to the current user
    const reel = await sql`
      SELECT * FROM reels WHERE id = ${id}
    `;

    if (reel.length === 0) {
      return NextResponse.json(
        { error: "Reel not found" },
        { status: 404 }
      );
    }

    if (reel[0].user_id !== userId) {
      return NextResponse.json(
        { error: "Unauthorized to delete this reel" },
        { status: 403 }
      );
    }

    // Delete likes for this reel
    await sql`
      DELETE FROM reel_likes WHERE reel_id = ${id}
    `;

    // Delete comments for this reel
    await sql`
      DELETE FROM reel_comments WHERE reel_id = ${id}
    `;

    // Delete the reel itself
    await sql`
      DELETE FROM reels WHERE id = ${id}
    `;

    return NextResponse.json(
      { message: "Reel deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete reel error:", error);
    return NextResponse.json(
      { error: "Failed to delete reel" },
      { status: 500 }
    );
  }
}
