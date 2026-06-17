export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

async function ensureViewTables() {
  await sql`ALTER TABLE reels ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0`.catch(() => {});
  await sql`
    CREATE TABLE IF NOT EXISTS reel_views (
      id BIGSERIAL PRIMARY KEY,
      reel_id TEXT NOT NULL,
      user_id TEXT,
      viewed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.catch(() => {});
  await sql`ALTER TABLE reel_views ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ DEFAULT NOW()`.catch(() => {});
  await sql`ALTER TABLE reel_views ADD COLUMN IF NOT EXISTS user_id TEXT`.catch(() => {});
  await sql`ALTER TABLE reel_views ADD COLUMN IF NOT EXISTS reel_id TEXT`.catch(() => {});
  await sql`
    CREATE INDEX IF NOT EXISTS idx_reel_views_reel_id
    ON reel_views(reel_id)
  `.catch(() => {});

  await sql`
    DELETE FROM reel_views a
    USING reel_views b
    WHERE a.user_id IS NOT NULL
      AND a.reel_id = b.reel_id
      AND a.user_id = b.user_id
      AND (
        a.viewed_at < b.viewed_at
        OR (a.viewed_at = b.viewed_at AND a.id < b.id)
      )
  `.catch(() => {});

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reel_views_unique_user
    ON reel_views(reel_id, user_id)
    WHERE user_id IS NOT NULL
  `.catch(() => {});
}

async function syncReelViewCount(reelId: string) {
  const result = await sql`
    WITH view_count AS (
      SELECT COUNT(*)::int AS count
      FROM reel_views
      WHERE reel_id = ${reelId}
        AND user_id IS NOT NULL
    )
    UPDATE reels
    SET views = (SELECT count FROM view_count)
    WHERE id = ${reelId}
    RETURNING views
  `;

  return Number(result[0]?.views ?? 0);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing reel ID" }, { status: 400 });
    }

    await ensureViewTables();

    const total = await syncReelViewCount(id);

    const viewers = await sql`
      SELECT
        u.id,
        COALESCE(u.name, 'CoFarmz User') AS name,
        COALESCE(u.image, '') AS image,
        COALESCE(u.role, '') AS role,
        COALESCE(u.location, '') AS location,
        rv.viewed_at::text AS viewed_at
      FROM reel_views rv
      INNER JOIN "user" u ON u.id = rv.user_id
      WHERE rv.reel_id = ${id}
      ORDER BY rv.viewed_at DESC
      LIMIT 100
    `;

    return NextResponse.json({
      viewers,
      count: total,
    });
  } catch (error) {
    console.error("Fetch reel viewers error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reel viewers", viewers: [] },
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
    const url = new URL(request.url);
    let body: any = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const userId =
      request.headers.get("x-user-id") ||
      body?.userId ||
      url.searchParams.get("userId") ||
      null;

    if (!id) {
      return NextResponse.json({ error: "Missing reel ID" }, { status: 400 });
    }

    await ensureViewTables();

    if (!userId) {
      const views = await syncReelViewCount(id);
      return NextResponse.json({ success: true, counted: false, views });
    }

    const existing = await sql`
      SELECT id
      FROM reel_views
      WHERE reel_id = ${id}
        AND user_id = ${userId}
      LIMIT 1
    `;

    let counted = false;

    if (existing.length > 0) {
      await sql`
        UPDATE reel_views
        SET viewed_at = NOW()
        WHERE id = ${existing[0].id}
      `;
    } else {
      try {
        const inserted = await sql`
          INSERT INTO reel_views (reel_id, user_id, viewed_at)
          VALUES (${id}, ${userId}, NOW())
          RETURNING id
        `;
        counted = inserted.length > 0;
      } catch (insertError: any) {
        if (insertError?.code !== "23505") {
          throw insertError;
        }
      }
    }

    const views = await syncReelViewCount(id);

    return NextResponse.json({ success: true, counted, views });
  } catch (error) {
    console.error("Increment view error:", error);
    return NextResponse.json(
      { error: "Failed to increment view" },
      { status: 500 }
    );
  }
}
