import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

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
}

export async function GET() {
  await ensureAnalyticsTable();

  // Daily new users for last 30 days
  const dailyGrowth = await sql`
    SELECT
      DATE("createdAt")::text AS date,
      COUNT(*)::int            AS new_users
    FROM "user"
    WHERE "createdAt" >= NOW() - INTERVAL '30 days'
    GROUP BY DATE("createdAt")
    ORDER BY DATE("createdAt") ASC
  `;

  // Totals by role
  const byRole = await sql`
    SELECT
      normalized.role,
      COUNT(*)::int AS count
    FROM (
      SELECT
        CASE
          WHEN LOWER(COALESCE(NULLIF(u.role, ''), r.name, 'unknown')) IN ('farmer', 'farmers') THEN 'farmer'
          WHEN LOWER(COALESCE(NULLIF(u.role, ''), r.name, 'unknown')) IN ('buyer', 'buyers') THEN 'buyer'
          WHEN LOWER(COALESCE(NULLIF(u.role, ''), r.name, 'unknown')) IN ('supplier', 'suppliers') THEN 'supplier'
          WHEN LOWER(COALESCE(NULLIF(u.role, ''), r.name, 'unknown')) IN ('fpo', 'fpos') THEN 'fpo'
          WHEN LOWER(COALESCE(NULLIF(u.role, ''), r.name, 'unknown')) IN ('superadmin', 'super_admin', 'admin') THEN 'superadmin'
          ELSE LOWER(COALESCE(NULLIF(u.role, ''), r.name, 'unknown'))
        END AS role
      FROM "user" u
      LEFT JOIN roles r ON u.role_id = r.id
    ) normalized
    GROUP BY normalized.role
    ORDER BY
      CASE normalized.role
        WHEN 'farmer' THEN 1
        WHEN 'buyer' THEN 2
        WHEN 'supplier' THEN 3
        WHEN 'fpo' THEN 4
        WHEN 'superadmin' THEN 5
        ELSE 9
      END
  `;

  const activitySummary = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM app_events WHERE event_type = 'login' AND created_at >= NOW() - INTERVAL '30 days') AS logins,
      (SELECT COUNT(*)::int FROM app_events WHERE event_type IN ('page_view', 'machinery_view', 'nearby_view', 'profile_view') AND created_at >= NOW() - INTERVAL '30 days') AS page_views,
      (SELECT COUNT(*)::int FROM reservations WHERE created_at >= NOW() - INTERVAL '30 days') AS reservations,
      (SELECT COUNT(*)::int FROM app_events WHERE event_type = 'machinery_view' AND created_at >= NOW() - INTERVAL '30 days') AS machinery_views,
      (SELECT COUNT(*)::int FROM app_events WHERE event_type = 'profile_view' AND created_at >= NOW() - INTERVAL '30 days') AS profile_views,
      (SELECT COUNT(*)::int FROM app_events WHERE event_type = 'nearby_view' AND created_at >= NOW() - INTERVAL '30 days') AS nearby_views,
      (SELECT COUNT(*)::int FROM app_events WHERE event_type = 'call_contact' AND created_at >= NOW() - INTERVAL '30 days') AS call_contacts,
      (SELECT COUNT(*)::int FROM messages WHERE created_at >= NOW() - INTERVAL '30 days') AS message_contacts,
      (
        (SELECT COUNT(*)::int FROM app_events WHERE event_type = 'call_contact' AND created_at >= NOW() - INTERVAL '30 days') +
        (SELECT COUNT(*)::int FROM messages WHERE created_at >= NOW() - INTERVAL '30 days')
      ) AS contacts
  `;

  const dailyActivity = await sql`
    WITH days AS (
      SELECT generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
    )
    SELECT
      days.day::text AS date,
      COALESCE(events.logins, 0)::int AS logins,
      COALESCE(events.page_views, 0)::int AS page_views,
      COALESCE(reservations.reservations, 0)::int AS reservations,
      (COALESCE(events.call_contacts, 0) + COALESCE(messages.message_contacts, 0))::int AS contacts
    FROM days
    LEFT JOIN (
      SELECT
        DATE(created_at) AS day,
        COUNT(*) FILTER (WHERE event_type = 'login')::int AS logins,
        COUNT(*) FILTER (WHERE event_type IN ('page_view', 'machinery_view', 'nearby_view', 'profile_view'))::int AS page_views,
        COUNT(*) FILTER (WHERE event_type = 'call_contact')::int AS call_contacts
      FROM app_events
      WHERE created_at >= CURRENT_DATE - INTERVAL '13 days'
      GROUP BY DATE(created_at)
    ) events ON events.day = days.day
    LEFT JOIN (
      SELECT DATE(created_at) AS day, COUNT(*)::int AS message_contacts
      FROM messages
      WHERE created_at >= CURRENT_DATE - INTERVAL '13 days'
      GROUP BY DATE(created_at)
    ) messages ON messages.day = days.day
    LEFT JOIN (
      SELECT DATE(created_at) AS day, COUNT(*)::int AS reservations
      FROM reservations
      WHERE created_at >= CURRENT_DATE - INTERVAL '13 days'
      GROUP BY DATE(created_at)
    ) reservations ON reservations.day = days.day
    ORDER BY days.day ASC
  `;

  const topPages = await sql`
    SELECT COALESCE(page_path, 'Unknown') AS page_path, COUNT(*)::int AS views
    FROM app_events
    WHERE event_type IN ('page_view', 'machinery_view', 'nearby_view', 'profile_view')
      AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY page_path
    ORDER BY views DESC
    LIMIT 8
  `;

  const recentLogins = await sql`
    SELECT
      user_id,
      COALESCE(user_name, u.name, 'Unknown user') AS user_name,
      COALESCE(user_email, u.email, '') AS user_email,
      created_at::text AS created_at,
      metadata->>'method' AS method
    FROM app_events e
    LEFT JOIN "user" u ON u.id = e.user_id
    WHERE event_type = 'login'
    ORDER BY e.created_at DESC
    LIMIT 10
  `;

  const recentReservations = await sql`
    SELECT
      r.id,
      r.user_id,
      renter.name AS renter_name,
      r.owner_id,
      owner.name AS owner_name,
      r.machinery_id,
      r.machinery_name,
      r.status,
      r.total_price,
      r.created_at::text AS created_at
    FROM reservations r
    LEFT JOIN "user" renter ON renter.id = r.user_id
    LEFT JOIN "user" owner ON owner.id = r.owner_id
    ORDER BY r.created_at DESC
    LIMIT 10
  `;

  const bookingStatusBreakdown = await sql`
    SELECT status, COUNT(*)::int AS count
    FROM reservations
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY status
    ORDER BY count DESC
  `;

  const equipmentBookingReport = await sql`
    SELECT
      r.machinery_id,
      COALESCE(MAX(r.machinery_name), MAX(m.name), 'Equipment') AS machinery_name,
      COALESCE(MAX(m.owner_id), MAX(r.owner_id)) AS owner_id,
      COALESCE(MAX(owner.name), 'Owner') AS owner_name,
      COUNT(*)::int AS bookings,
      COUNT(*) FILTER (WHERE r.status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE r.status = 'accepted')::int AS accepted,
      COUNT(*) FILTER (WHERE r.status = 'completed')::int AS completed,
      COUNT(*) FILTER (WHERE r.status IN ('rejected', 'cancelled'))::int AS lost,
      COALESCE(SUM(r.total_price), 0)::numeric AS revenue_requested,
      MAX(r.created_at)::text AS last_booked_at
    FROM reservations r
    LEFT JOIN machinery m ON m.id = r.machinery_id
    LEFT JOIN "user" owner ON owner.id = COALESCE(m.owner_id, r.owner_id)
    WHERE r.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY r.machinery_id
    ORDER BY bookings DESC, last_booked_at DESC
    LIMIT 10
  `;

  const topMachineryViews = await sql`
    SELECT
      e.entity_id AS machinery_id,
      COALESCE(MAX(m.name), MAX(e.entity_name), 'Machinery') AS machinery_name,
      COUNT(*)::int AS views
    FROM app_events e
    LEFT JOIN machinery m ON m.id = e.entity_id
    WHERE e.event_type = 'machinery_view'
      AND e.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY e.entity_id
    ORDER BY views DESC
    LIMIT 8
  `;

  const profileViews = await sql`
    WITH profile_events AS (
      SELECT
        COALESCE(
          e.entity_id,
          NULLIF(split_part(split_part(COALESCE(e.page_path, ''), 'id=', 2), '&', 1), '')
        ) AS viewed_profile_id
      FROM app_events e
      WHERE e.event_type = 'profile_view'
        AND e.created_at >= NOW() - INTERVAL '30 days'
    )
    SELECT
      COALESCE(pe.viewed_profile_id, 'unknown') AS profile_id,
      COALESCE(MAX(u.name), 'Profile') AS profile_name,
      COALESCE(MAX(u.email), '') AS profile_email,
      COUNT(*)::int AS views
    FROM profile_events pe
    LEFT JOIN "user" u ON u.id = pe.viewed_profile_id
    GROUP BY pe.viewed_profile_id
    ORDER BY views DESC
    LIMIT 8
  `;

  const profileViewDetails = await sql`
    WITH profile_events AS (
      SELECT
        e.*,
        COALESCE(
          e.entity_id,
          NULLIF(split_part(split_part(COALESCE(e.page_path, ''), 'id=', 2), '&', 1), '')
        ) AS viewed_profile_id
      FROM app_events e
      WHERE e.event_type = 'profile_view'
        AND e.created_at >= NOW() - INTERVAL '30 days'
    )
    SELECT
      pe.id,
      pe.user_id AS viewer_id,
      COALESCE(pe.user_name, viewer.name, 'Guest user') AS viewer_name,
      COALESCE(pe.user_email, viewer.email, '') AS viewer_email,
      pe.viewed_profile_id AS profile_id,
      COALESCE(viewed.name, 'Unknown profile') AS profile_name,
      COALESCE(viewed.email, '') AS profile_email,
      pe.page_path,
      pe.created_at::text AS created_at
    FROM profile_events pe
    LEFT JOIN "user" viewer ON viewer.id = pe.user_id
    LEFT JOIN "user" viewed ON viewed.id = pe.viewed_profile_id
    ORDER BY pe.created_at DESC
    LIMIT 20
  `;

  const nearbyViews = await sql`
    SELECT
      COALESCE(metadata->>'type', 'farmers') AS type,
      COUNT(*)::int AS views
    FROM app_events
    WHERE event_type = 'nearby_view'
      AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY metadata->>'type'
    ORDER BY views DESC
  `;

  const recentMessageContacts = await sql`
    SELECT
      m.id,
      'message' AS contact_type,
      m.sender_id,
      COALESCE(sender.name, 'Unknown user') AS sender_name,
      COALESCE(sender.email, '') AS sender_email,
      m.receiver_id,
      COALESCE(receiver.name, 'Unknown user') AS receiver_name,
      COALESCE(receiver.email, '') AS receiver_email,
      m.machinery_id,
      COALESCE(machinery.name, '') AS machinery_name,
      m.message_type,
      m.created_at::text AS created_at
    FROM messages m
    LEFT JOIN "user" sender ON sender.id = m.sender_id
    LEFT JOIN "user" receiver ON receiver.id = m.receiver_id
    LEFT JOIN machinery ON machinery.id = m.machinery_id
    WHERE m.created_at >= NOW() - INTERVAL '30 days'
    ORDER BY m.created_at DESC
    LIMIT 20
  `;

  const recentCallContacts = await sql`
    SELECT
      e.id,
      'call' AS contact_type,
      e.user_id AS sender_id,
      COALESCE(e.user_name, caller.name, 'Unknown user') AS sender_name,
      COALESCE(e.user_email, caller.email, '') AS sender_email,
      e.entity_id AS receiver_id,
      COALESCE(e.entity_name, receiver.name, 'Unknown user') AS receiver_name,
      COALESCE(receiver.email, '') AS receiver_email,
      metadata->>'machinery_id' AS machinery_id,
      COALESCE(metadata->>'machinery_name', '') AS machinery_name,
      COALESCE(metadata->>'source', 'call') AS message_type,
      e.created_at::text AS created_at
    FROM app_events e
    LEFT JOIN "user" caller ON caller.id = e.user_id
    LEFT JOIN "user" receiver ON receiver.id = e.entity_id
    WHERE e.event_type = 'call_contact'
      AND e.created_at >= NOW() - INTERVAL '30 days'
    ORDER BY e.created_at DESC
    LIMIT 20
  `;

  const recentEvents = await sql`
    SELECT
      event_type,
      user_id,
      COALESCE(user_name, u.name, 'Guest') AS user_name,
      COALESCE(user_email, u.email, '') AS user_email,
      page_path,
      entity_type,
      entity_id,
      entity_name,
      created_at::text AS created_at
    FROM app_events e
    LEFT JOIN "user" u ON u.id = e.user_id
    ORDER BY e.created_at DESC
    LIMIT 20
  `;

  return NextResponse.json({
    dailyGrowth,
    byRole,
    activitySummary: activitySummary[0] || {},
    dailyActivity,
    topPages,
    recentLogins,
    recentReservations,
    bookingStatusBreakdown,
    equipmentBookingReport,
    topMachineryViews,
    profileViews,
    profileViewDetails,
    nearbyViews,
    recentMessageContacts,
    recentCallContacts,
    recentEvents,
  });
}
