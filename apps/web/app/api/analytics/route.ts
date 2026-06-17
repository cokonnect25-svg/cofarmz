export const dynamic = 'force-dynamic';

import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

async function ensureAnalyticsTable() {
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

  await sql`CREATE INDEX IF NOT EXISTS idx_app_events_created_at ON app_events(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_app_events_event_type ON app_events(event_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_app_events_user_id ON app_events(user_id)`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      eventType,
      userId,
      userName,
      userEmail,
      pagePath,
      entityType,
      entityId,
      entityName,
      metadata,
    } = body || {};

    if (!eventType) {
      return NextResponse.json({ error: "Missing eventType" }, { status: 400 });
    }

    await ensureAnalyticsTable();

    const result = await sql`
      INSERT INTO app_events (
        event_type, user_id, user_name, user_email, page_path,
        entity_type, entity_id, entity_name, metadata
      )
      VALUES (
        ${eventType}, ${userId || null}, ${userName || null}, ${userEmail || null},
        ${pagePath || null}, ${entityType || null}, ${entityId || null},
        ${entityName || null}, ${metadata ? sql.json(metadata) : sql.json({})}
      )
      RETURNING id
    `;

    return NextResponse.json({ ok: true, id: result[0]?.id });
  } catch (error) {
    console.error("POST /api/analytics error:", error);
    return NextResponse.json({ error: "Failed to record analytics event" }, { status: 500 });
  }
}
