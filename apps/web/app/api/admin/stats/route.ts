import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
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
    SELECT r.name AS role, COUNT(u.id)::int AS count
    FROM "user" u
    LEFT JOIN roles r ON u.role_id = r.id
    GROUP BY r.name
  `;

  return NextResponse.json({ dailyGrowth, byRole });
}