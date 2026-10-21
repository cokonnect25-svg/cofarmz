import { requireActor, fpoError, FpoError } from '@/lib/fpo-access';
import { assignFarmer } from '@/lib/fpo-assignment';
import { resolveLegacyLocation } from '@/lib/fpo-location';
import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";
import { sendPushToUser } from "@/app/api/utils/push";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["farmer", "buyer"]);

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS role_change_requests (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      current_role VARCHAR(20) NOT NULL,
      requested_role VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      reviewed_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT role_change_requests_one_per_user UNIQUE (user_id),
      CONSTRAINT role_change_requests_status_check
        CHECK (status IN ('pending', 'approved', 'rejected'))
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_role_change_requests_status
    ON role_change_requests(status, created_at DESC)
  `;
}

async function isAdmin(userId: string) {
  const rows = await sql`
    SELECT 1
    FROM "user"
    WHERE id = ${userId}
      AND (LOWER(COALESCE(role, '')) IN ('admin', 'superadmin') OR role_id = 5)
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await ensureSchema();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const adminId = searchParams.get("adminId");

    if ((adminId && adminId !== actor.id) || (userId && userId !== actor.id)) return NextResponse.json({error:"Forbidden"},{status:403});
    if (adminId) {
      if (!(await isAdmin(adminId))) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
      const requests = await sql`
        SELECT
          r.*, u.name AS user_name, u.email AS user_email, u.image AS user_image
        FROM role_change_requests r
        JOIN "user" u ON u.id = r.user_id
        ORDER BY
          CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
          r.created_at DESC
        LIMIT 100
      `;
      return NextResponse.json({ requests });
    }

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    const rows = await sql`
      SELECT id, current_role, requested_role, status, created_at, reviewed_at
      FROM role_change_requests
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    return NextResponse.json({ request: rows[0] || null, canRequest: rows.length === 0 });
  } catch (error) {
    console.error("Role request GET error:", error);
    return fpoError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    await ensureSchema();
    const { userId, requestedRole } = await request.json();
    if(userId !== actor.id) return NextResponse.json({error:"Forbidden"},{status:403});
    if (!userId || !ALLOWED_ROLES.has(requestedRole)) {
      return NextResponse.json({ error: "A valid user and role are required" }, { status: 400 });
    }

    const users = await sql`
      SELECT
        CASE
          WHEN LOWER(COALESCE(role, '')) = 'farmer' OR role_id = 1 THEN 'farmer'
          WHEN LOWER(COALESCE(role, '')) = 'buyer' OR role_id = 2 THEN 'buyer'
          ELSE LOWER(COALESCE(role, ''))
        END AS current_role
      FROM "user"
      WHERE id = ${userId}
      LIMIT 1
    `;
    const currentRole = users[0]?.current_role;
    if (!ALLOWED_ROLES.has(currentRole)) {
      return NextResponse.json({ error: "Only farmer and buyer profiles can use this request" }, { status: 400 });
    }
    if (currentRole === requestedRole) {
      return NextResponse.json({ error: `Your profile is already ${requestedRole}` }, { status: 400 });
    }

    const existing = await sql`
      SELECT status FROM role_change_requests WHERE user_id = ${userId} LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Your one-time role-change request has already been used", status: existing[0].status },
        { status: 409 }
      );
    }

    const rows = await sql`
      INSERT INTO role_change_requests (user_id, current_role, requested_role)
      VALUES (${userId}, ${currentRole}, ${requestedRole})
      RETURNING id, current_role, requested_role, status, created_at
    `;
    return NextResponse.json({ request: rows[0], canRequest: false }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "Your one-time role-change request has already been used" },
        { status: 409 }
      );
    }
    console.error("Role request POST error:", error);
    return fpoError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireActor(request);
    await ensureSchema();
    const { adminId, requestId, action } = await request.json();
    if(adminId !== actor.id) return NextResponse.json({error:"Forbidden"},{status:403});
    if (!adminId || !requestId || !["approved", "rejected"].includes(action)) {
      return NextResponse.json({ error: "Invalid review request" }, { status: 400 });
    }
    if (!(await isAdmin(adminId))) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const reviewed = await sql.begin(async transaction => {
      const [pending] = await transaction`
      SELECT id, user_id, requested_role
      FROM role_change_requests
      WHERE id = ${Number(requestId)} AND status = 'pending'
      FOR UPDATE
    `;
      if (!pending) throw new FpoError('This request has already been reviewed',409);
      if (!ALLOWED_ROLES.has(pending.requested_role)) throw new FpoError('Invalid requested role');

    const roleId = pending.requested_role === "farmer" ? 1 : 2;
    if (action === "approved") {
        const [u] = await transaction`SELECT * FROM "user" WHERE id=${pending.user_id} FOR UPDATE`;
        if (!u) throw new FpoError('User not found',404);
        const resolved = pending.requested_role === 'farmer' && !u.district_id
          ? await resolveLegacyLocation(u) : null;
        const districtId = u.district_id || resolved?.district?.id || null;
        await transaction`
          UPDATE "user"
          SET role = ${pending.requested_role}, role_id = ${roleId}, role_confirmed = true,
              district_id=${districtId}, "updatedAt"=now()
          WHERE id = ${pending.user_id}
        `;
        await assignFarmer(transaction,pending.user_id,districtId,resolved?.source || 'profile_update',resolved?.reason || null);
    }
    await transaction`
          UPDATE role_change_requests
          SET status = ${action}, reviewed_by = ${adminId}, reviewed_at = NOW()
          WHERE id = ${Number(requestId)} AND status = 'pending'
        `;
    return pending;
    });

    await sendPushToUser(reviewed.user_id, {
      title: `Role-change request ${action}`,
      body: action === "approved"
        ? `Your profile is now a ${reviewed.requested_role}.`
        : "The admin rejected your role-change request. Your current role remains unchanged.",
      url: "/user-profile",
      tag: `role-change-${reviewed.user_id}`,
      data: { type: "role_change", status: action },
    }).catch(error => console.error('Role-change notification failed', error));

    return NextResponse.json({ success: true, status: action });
  } catch (error) {
    console.error("Role request PATCH error:", error);
    return fpoError(error);
  }
}
