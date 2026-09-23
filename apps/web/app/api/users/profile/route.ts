import { requireActor, fpoError, FpoError, rejectAssignmentInput } from '@/lib/fpo-access';
import { assignFarmer, prepareLocation } from '@/lib/fpo-assignment';
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
  try {
    const actor = await requireActor(request);
    const body = await request.json();
    if (body.address !== undefined && body.location === undefined) body.location = body.address;
    rejectAssignmentInput(body);
    if (body.userId && body.userId !== actor.id) throw new FpoError('Forbidden',403);
    const role = body.role;
    if (!['farmer','buyer','supplier','fpo'].includes(role)) throw new FpoError('Invalid role');
    const supplierTypes = role === 'supplier' ? normalizeSupplierTypes(body.supplier_types) : [];
    if (role === 'supplier' && !supplierTypes.length) throw new FpoError('Select at least one supplier type');
    const location = role === 'farmer' ? await prepareLocation(body,{},true) : null;
    const result = await sql.begin(async tx => {
      const [u] = await tx`SELECT * FROM "user" WHERE id=${actor.id} FOR UPDATE`;
      if (u.role_confirmed) throw new FpoError('Your role is already confirmed',403);
      const [r] = await tx`SELECT id FROM roles WHERE name=${role}`;
      if (!r) throw new FpoError('Role is not configured');
      const [updated] = await tx`UPDATE "user" SET role=${role},role_id=${r.id},supplier_types=${supplierTypes}::text[],role_confirmed=true,district_id=${location?.district?.id || null},"updatedAt"=now() WHERE id=${actor.id} RETURNING id,email,role,role_id,supplier_types`;
      if (location) await assignFarmer(tx,actor.id,location.district.id,'registration');
      return updated;
    });
    return NextResponse.json(result);
  } catch(error) { return fpoError(error); }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireActor(request);
    const body = await request.json();
    if (body.address !== undefined && body.location === undefined) body.location = body.address;
    rejectAssignmentInput(body);
    const { userId, name, email, phone, location, gender, age, bio, latitude, longitude, supplier_types, calling_enabled } = body;
    if (userId !== actor.id) throw new FpoError('Forbidden',403);

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
      SELECT *
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

    const resolved = await prepareLocation(body,currentUserRows[0]);
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

    if (body.image !== undefined) {
      updates.push(`image = $${values.length + 1}`); values.push(body.image);
    }
    if (name !== undefined) {
      updates.push(`name = $${values.length + 1}`);
      values.push(name);
    }
    if (email !== undefined) {
      updates.push(`email = $${values.length + 1}`);
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${values.length + 1}`);
      values.push(normalizedPhone?.value || null);

      if (normalizePhone(currentPhone || "").lookup !== normalizedPhone?.lookup) {
        updates.push(`phone_verified = false`);
        updates.push(`phone_verified_at = NULL`);
      }
    }
    if (location !== undefined) {
      updates.push(`location = $${values.length + 1}`);
      values.push(location);
    }
    if (gender !== undefined) {
      updates.push(`gender = $${values.length + 1}`);
      values.push(gender);
    }
    if (age !== undefined) {
      updates.push(`age = $${values.length + 1}`);
      values.push(age ? parseInt(age) : null);
    }
    if (bio !== undefined) {
      updates.push(`bio = $${values.length + 1}`);
      values.push(String(bio).trim().slice(0, 150) || null);
    }
    if (latitude !== undefined) {
      updates.push(`latitude = $${values.length + 1}`);
      values.push(latitude);
    }
    if (longitude !== undefined) {
      updates.push(`longitude = $${values.length + 1}`);
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
      updates.push(`supplier_types = $${values.length + 1}::text[]`);
      values.push(currentRole === "supplier" ? supplierTypes : []);
    }
    if (calling_enabled !== undefined) {
      updates.push(`calling_enabled = $${values.length + 1}`);
      values.push(Boolean(calling_enabled));
    }

    if (location !== undefined && location !== currentUserRows[0].location && latitude === undefined && longitude === undefined) {
      updates.push('latitude = NULL', 'longitude = NULL');
    }
    if (resolved) {
      updates.push(`district_id = $${values.length + 1}`);
      values.push(resolved.district?.id || null);
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
    await sql.begin(async tx => {
      const [locked] = await tx`SELECT * FROM "user" WHERE id=${userId} FOR UPDATE`;
      if (new Date(locked.updatedAt).getTime() !== new Date(currentUserRows[0].updatedAt).getTime()) throw new FpoError('Profile changed; please retry',409);
      await tx.unsafe(query, values);
      if (resolved) await assignFarmer(tx,userId,resolved.district?.id || null,resolved.source,resolved.reason);
    });

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
    return fpoError(error);
  }
}
