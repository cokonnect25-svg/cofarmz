import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // We use SELECT * for user to avoid "column does not exist" crashes
    // if role_confirmed hasn't been added to the schema in production yet.
    const result = await sql`
      SELECT
        u.*,
        r.display_name as role_display_name,
        r.permissions as role_permissions
      FROM "user" u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ${userId}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userProfile = result[0];
    delete userProfile.password;

    // ✅ Infer role from role_id if role string is missing (for legacy users)
    if (!userProfile.role && userProfile.role_id) {
      if (userProfile.role_id === 1) userProfile.role = 'farmer';
      else if (userProfile.role_id === 2) userProfile.role = 'buyer';
      else if (userProfile.role_id === 3) userProfile.role = 'Supplier';
    }

    return NextResponse.json(userProfile);
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const errors: string[] = [];
  try {
    const body = await request.json();
    const { email, role, userId } = body;

const allowedRoles = ['farmer', 'buyer', 'Supplier'];

if (!role || !allowedRoles.includes(role)) {
  return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
}
    if (!email && !userId) {
      return NextResponse.json({ error: 'email or userId is required' }, { status: 400 });
    }

    // Ensure roles table + columns exist
    try {
      await sql`CREATE TABLE IF NOT EXISTS roles (id SERIAL PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE, display_name VARCHAR(100) NOT NULL)`;
await sql`
  INSERT INTO roles (id,name,display_name)
  VALUES 
    (1,'farmer','Farmer'),
    (2,'buyer','Buyer'),
    (3,'Supplier','Supplier')
  ON CONFLICT (id) DO NOTHING
`;
      await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'buyer'`;
      await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role_id INTEGER`;
    } catch (e: any) { errors.push('setup: ' + e.message); }

    const roleRow = await sql`
  SELECT id FROM roles WHERE name = ${role}
`;

if (roleRow.length === 0) {
  return NextResponse.json({ error: 'Role not found in DB' }, { status: 400 });
}

const roleId = roleRow[0].id;
    let result: any[] = [];

    // Try by userId first (most reliable), then email
    const whereClause = userId ? sql`WHERE id = ${userId}` : sql`WHERE email = ${email}`;

    // Also ensure role_confirmed column exists
    try {
      await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role_confirmed BOOLEAN DEFAULT false`;
    } catch (e: any) { errors.push('role_confirmed col: ' + e.message); }

    try {
      result = await sql`UPDATE "user" SET role = ${role}, role_id = ${roleId}, role_confirmed = true ${whereClause} RETURNING id, email, role, role_id`;
    } catch (e: any) {
      errors.push('update1: ' + e.message);
      try {
        result = await sql`UPDATE "user" SET role = ${role}, role_confirmed = true ${whereClause} RETURNING id, email, role`;
      } catch (e2: any) {
        errors.push('update2: ' + e2.message);
      }
    }

    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found', debug: errors }, { status: 404 });
    }

    return NextResponse.json({ ...result[0], debug: errors });
  } catch (error: any) {
    console.error('Profile POST error:', error);
    return NextResponse.json({ error: error.message, debug: errors }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { userId, name, email, phone, location, gender, age, latitude, longitude } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Ensure latitude/longitude columns exist
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`.catch(() => { });
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`.catch(() => { });

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push(`name = $${updates.length + 1}`);
      values.push(name);
    }
    if (email !== undefined) {
      updates.push(`email = $${updates.length + 1}`);
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${updates.length + 1}`);
      values.push(phone);
    }
    if (location !== undefined) {
      updates.push(`location = $${updates.length + 1}`);
      values.push(location);
    }
    if (gender !== undefined) {
      updates.push(`gender = $${updates.length + 1}`);
      values.push(gender);
    }
    if (age !== undefined) {
      updates.push(`age = $${updates.length + 1}`);
      values.push(age ? parseInt(age) : null);
    }
    if (latitude !== undefined) {
      updates.push(`latitude = $${updates.length + 1}`);
      values.push(latitude);
    }
    if (longitude !== undefined) {
      updates.push(`longitude = $${updates.length + 1}`);
      values.push(longitude);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Add userId at the end
    values.push(userId);

    // Build the update query dynamically
    const query = `UPDATE "user" SET ${updates.join(", ")}, "updatedAt" = NOW() WHERE id = $${values.length} RETURNING id`;

    // Execute update using unsafe for dynamic SQL
    await sql.unsafe(query, values);

    // Fetch updated user with role information
    const result = await sql`
      SELECT
        u.id, u.name, u.email, u.phone, u.location, u.image, u.gender, u.age,
        u.role_id,
        u.role,
        r.display_name as role_display_name,
        r.permissions as role_permissions
      FROM "user" u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ${userId}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
