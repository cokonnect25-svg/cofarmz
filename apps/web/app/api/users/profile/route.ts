import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const SUPPLIER_TYPES = ['commodities', 'equipment'] as const;

function normalizeSupplierTypes(value: any): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return Array.from(new Set(list.map((v: any) => String(v).trim().toLowerCase()).filter(v => (SUPPLIER_TYPES as readonly string[]).includes(v))));
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) return { value: "", lookup: "", legacyLookup: "" };
  if (digits.length === 10) return { value: `+91${digits}`, lookup: `91${digits}`, legacyLookup: digits };
  if (digits.length === 12 && digits.startsWith("91")) {
    return { value: `+${digits}`, lookup: digits, legacyLookup: digits.slice(2) };
  }

  return { value: `+${digits}`, lookup: digits, legacyLookup: "" };
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS calling_enabled BOOLEAN DEFAULT true`.catch(() => { });
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS bio TEXT`.catch(() => { });

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
  else if (userProfile.role_id === 3) userProfile.role = 'supplier';
  else if (userProfile.role_id === 4) userProfile.role = 'fpo';
  else if (userProfile.role_id === 5) userProfile.role = 'superadmin';
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
    const supplierTypes = role === 'supplier' ? normalizeSupplierTypes(body.supplier_types) : [];

const allowedRoles = ['farmer', 'buyer', 'supplier', 'fpo', 'superadmin'];

if (!role || !allowedRoles.includes(role)) {
  return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
}
    if (role === 'supplier' && supplierTypes.length === 0) {
      return NextResponse.json({ error: 'Select at least one supplier type' }, { status: 400 });
    }
    if (!email && !userId) {
      return NextResponse.json({ error: 'email or userId is required' }, { status: 400 });
    }

    // Ensure roles table + columns exist
    try {
      await sql`CREATE TABLE IF NOT EXISTS roles (id SERIAL PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE, display_name VARCHAR(100) NOT NULL)`;

await sql`
  INSERT INTO roles (id, name, display_name)
  VALUES 
    (1, 'farmer',     'Farmer'),
    (2, 'buyer',      'Buyer'),
    (3, 'supplier',   'Supplier'),
    (4, 'fpo',        'Farmer Produce Organization'),
    (5, 'superadmin', 'Super Admin')
  ON CONFLICT (id) DO NOTHING
`;
      await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'buyer'`;
      await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role_id INTEGER`;
      await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS supplier_types TEXT[] DEFAULT ARRAY[]::TEXT[]`;
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

    const currentUsers = userId
      ? await sql`SELECT role, role_confirmed FROM "user" WHERE id = ${userId} LIMIT 1`
      : await sql`SELECT role, role_confirmed FROM "user" WHERE email = ${email} LIMIT 1`;
    if (currentUsers[0]?.role_confirmed === true) {
      return NextResponse.json(
        { error: 'Your role is already confirmed. Submit the one-time role-change request from your profile.' },
        { status: 403 }
      );
    }

    try {
      result = await sql`UPDATE "user" SET role = ${role}, role_id = ${roleId}, supplier_types = ${supplierTypes}::text[], role_confirmed = true ${whereClause} RETURNING id, email, role, role_id, supplier_types`;
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
    const { userId, name, email, phone, location, gender, age, bio, latitude, longitude, supplier_types, calling_enabled } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Ensure latitude/longitude columns exist
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`.catch(() => { });
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`.catch(() => { });
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false`.catch(() => { });
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ`.catch(() => { });
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS supplier_types TEXT[] DEFAULT ARRAY[]::TEXT[]`.catch(() => { });
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS calling_enabled BOOLEAN DEFAULT true`.catch(() => { });
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS bio TEXT`.catch(() => { });

    const currentUserRows = await sql`
      SELECT role, role_id
      FROM "user"
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (currentUserRows.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const currentRole =
      currentUserRows[0].role ||
      (currentUserRows[0].role_id === 3 ? "supplier" : null);

    let normalizedPhone: { value: string; lookup: string; legacyLookup: string } | null = null;
    let currentPhone: string | null = null;

    if (phone !== undefined) {
      normalizedPhone = normalizePhone(String(phone));

      const currentUser = await sql`
        SELECT phone
        FROM "user"
        WHERE id = ${userId}
        LIMIT 1
      `;
      currentPhone = currentUser[0]?.phone || null;
      const phoneChanged = normalizePhone(currentPhone || "").lookup !== normalizedPhone.lookup;

      if (phoneChanged && normalizedPhone.lookup) {
        const duplicatePhone = await sql`
          SELECT id
          FROM "user"
          WHERE id <> ${userId}
            AND phone IS NOT NULL
            AND phone <> ''
            AND (
              regexp_replace(phone, '[^0-9]', '', 'g') = ${normalizedPhone.lookup}
              OR (${normalizedPhone.legacyLookup} <> '' AND regexp_replace(phone, '[^0-9]', '', 'g') = ${normalizedPhone.legacyLookup})
            )
          LIMIT 1
        `;

        if (duplicatePhone.length > 0) {
          return NextResponse.json(
            { error: "This mobile number is already linked to another account." },
            { status: 409 }
          );
        }
      }
    }

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
      values.push(normalizedPhone?.value || null);

      if (normalizePhone(currentPhone || "").lookup !== normalizedPhone?.lookup) {
        updates.push(`phone_verified = false`);
        updates.push(`phone_verified_at = NULL`);
      }
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
    if (bio !== undefined) {
      updates.push(`bio = $${updates.length + 1}`);
      values.push(String(bio).trim().slice(0, 150) || null);
    }
    if (latitude !== undefined) {
      updates.push(`latitude = $${updates.length + 1}`);
      values.push(latitude);
    }
    if (longitude !== undefined) {
      updates.push(`longitude = $${updates.length + 1}`);
      values.push(longitude);
    }
    if (supplier_types !== undefined) {
      const supplierTypes = normalizeSupplierTypes(supplier_types);
      if (currentRole === "supplier" && supplierTypes.length === 0) {
        return NextResponse.json(
          { error: "Select at least one supplier type" },
          { status: 400 }
        );
      }
      updates.push(`supplier_types = $${updates.length + 1}::text[]`);
      values.push(currentRole === "supplier" ? supplierTypes : []);
    }
    if (calling_enabled !== undefined) {
      updates.push(`calling_enabled = $${updates.length + 1}`);
      values.push(Boolean(calling_enabled));
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
        u.id, u.name, u.email, u.phone, u.location, u.image, u.gender, u.age, u.bio,
        u.phone_verified, u.phone_verified_at,
        u.calling_enabled,
        u.role_id,
        u.supplier_types,
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
