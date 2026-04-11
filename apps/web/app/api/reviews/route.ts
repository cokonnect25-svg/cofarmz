import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const machineryId = searchParams.get("machinery_id");
  const userId = searchParams.get("user_id");

  try {
    if (machineryId) {
      const reviews = await sql`
        SELECT 
          r.*,
          u.name as reviewer_name,
          u.image as reviewer_image
        FROM reviews r
        JOIN "user" u ON r.user_id = u.id
        WHERE r.machinery_id = ${machineryId}
        ORDER BY r.created_at DESC
      `;
      return NextResponse.json(reviews);
    }

    if (userId) {
      const userReviews = await sql`
        SELECT * FROM reviews
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
      return NextResponse.json(userReviews);
    }

    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user_id, machinery_id, reservation_id, rating, review_text } = await request.json();

  try {
    // Check if user already reviewed this reservation
    const existingReview = await sql`
      SELECT id FROM reviews WHERE reservation_id = ${reservation_id} AND user_id = ${user_id}
    `;

    if (existingReview.length > 0) {
      return NextResponse.json(
        { error: "You have already reviewed this booking" },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO reviews (user_id, machinery_id, reservation_id, rating, review_text)
      VALUES (${user_id}, ${machinery_id}, ${reservation_id}, ${rating}, ${review_text})
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error creating review:", error);
    return NextResponse.json({ error: "Failed to create review" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { id, rating, review_text } = await request.json();

  try {
    const result = await sql`
      UPDATE reviews
      SET rating = ${rating}, review_text = ${review_text}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error updating review:", error);
    return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  try {
    const result = await sql`DELETE FROM reviews WHERE id = ${id} RETURNING id`;

    if (result.length === 0) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting review:", error);
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}
