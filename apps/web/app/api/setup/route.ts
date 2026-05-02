export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

// POST /api/setup — ensures DB has all required columns and the roles table is seeded
export async function POST() {
  const results: string[] = [];

  try {
    // 0. Create Better Auth core tables if they don't exist
    await sql`
      CREATE TABLE IF NOT EXISTS "user" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        "emailVerified" BOOLEAN NOT NULL DEFAULT false,
        image TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `.catch(() => {});

    await sql`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        "expiresAt" TIMESTAMP NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `.catch(() => {});

    await sql`
      CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "accessTokenExpiresAt" TIMESTAMP,
        scope TEXT,
        "idToken" TEXT,
        password TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `.catch(() => {});

    await sql`
      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `.catch(() => {});

    results.push("better-auth tables ensured");

    // 1. Ensure roles table exists and has data
    await sql`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        permissions JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push("roles table ensured");

await sql`
  INSERT INTO roles (id, name, display_name, description, permissions)
  VALUES
    (1, 'farmer', 'Farmer', 'Can list crops & machinery',
      '{"can_list_crops": true, "can_list_machinery": true, "can_rent_machinery": true}'::jsonb),

    (2, 'buyer', 'Buyer', 'Can buy crop waste',
      '{"can_buy_crop_waste": true, "can_rent_machinery": true}'::jsonb),

    (3, 'supplier', 'supplier', 'Can manage machinery only',
      '{"can_list_machinery": true, "can_edit_machinery": true, "can_list_crops": false}'::jsonb)

  ON CONFLICT (id) DO UPDATE
  SET permissions = EXCLUDED.permissions
`;
    // Remove admin role if it exists
    await sql`DELETE FROM roles WHERE name = 'admin'`.catch(() => {});
    // Update any admin users to buyer
    await sql`UPDATE "user" SET role = 'buyer', role_id = 2 WHERE role = 'admin'`.catch(() => {});
    results.push("roles seeded, admin removed");

    // Fix existing crop data: trim spaces + set all crop_type to 'grow'
    await sql`UPDATE crops SET crop_name = TRIM(crop_name), crop_type = 'grow'`.catch(() => {});
    results.push("crop names trimmed, crop_type normalized");

    // 2. Add role column to user table if missing
    await sql`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'buyer'
    `;
    results.push("role column ensured");

    // 3. Add role_id column if missing, ensure it is nullable
    await sql`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id)
    `.catch(() => {});
    // Drop NOT NULL constraint on role_id so Better Auth can insert users freely
    await sql`ALTER TABLE "user" ALTER COLUMN role_id DROP NOT NULL`.catch(() => {});
    results.push("role_id column ensured (nullable)");

    // 4. Ensure crops table exists
    await sql`
      CREATE TABLE IF NOT EXISTS crops (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        crop_name VARCHAR(100) NOT NULL,
        years_of_experience INTEGER,
        expertise_level VARCHAR(50) DEFAULT 'Beginner',
        expected_yield_date DATE,
        expected_yield_quantity NUMERIC,
        expected_yield_quantity_uom VARCHAR(20) DEFAULT 'kg',
        crop_type VARCHAR(20) DEFAULT 'grow',
        is_crop_waste BOOLEAN DEFAULT false,
        certification_type VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push("crops table ensured");

    // 4a. Add crop_type and is_crop_waste columns if missing (for existing tables)
    await sql`ALTER TABLE crops ADD COLUMN IF NOT EXISTS crop_type VARCHAR(20) DEFAULT 'grow'`.catch(() => {});
    await sql`ALTER TABLE crops ADD COLUMN IF NOT EXISTS is_crop_waste BOOLEAN DEFAULT false`.catch(() => {});
    await sql`ALTER TABLE crops ADD COLUMN IF NOT EXISTS certification_type VARCHAR(50) DEFAULT NULL`.catch(() => {});
    // Drop restrictive check constraint so buyer crop_type='buy' is allowed
    await sql`ALTER TABLE crops DROP CONSTRAINT IF EXISTS crops_crop_type_check`.catch(() => {});
    results.push("crop_type/is_crop_waste columns ensured, check constraint dropped");

    // 4b. Add lat/lon columns if missing
    await sql`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7)
    `;
    await sql`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7)
    `;
    results.push("latitude/longitude columns ensured");

    // 5. Add location column if missing
    await sql`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS location TEXT
    `;
    results.push("location column ensured");

    // 6. Add phone column if missing
    await sql`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS phone TEXT
    `;
    results.push("phone column ensured");

    // 7. Add role_confirmed column to track explicit role selection
    await sql`
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role_confirmed BOOLEAN DEFAULT false
    `;
    results.push("role_confirmed column ensured");

    // 8. Sync role_id only for users who explicitly confirmed their role
    await sql`
      UPDATE "user" u
      SET role_id = r.id
      FROM roles r
      WHERE r.name = u.role AND u.role_confirmed = true AND (u.role_id IS NULL OR u.role_id != r.id)
    `;
    results.push("role_id synced for confirmed users only");

    // 8. Check users with roles
    const userStats = await sql`
      SELECT role, COUNT(*) as count FROM "user" GROUP BY role
    `;
    results.push(`user roles: ${JSON.stringify(userStats)}`);

    // 9. Check which tables exist
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `;
    results.push(`tables: ${tables.map((t: any) => t.table_name).join(', ')}`);

    // 10. Test direct user insert to verify table works
    const testId = 'test_' + Date.now();
    try {
      await sql`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES (${testId}, 'Test', 'test_probe@test.com', false, NOW(), NOW()) ON CONFLICT DO NOTHING`;
      await sql`DELETE FROM "user" WHERE id = ${testId}`;
      results.push('user table insert test: OK');
    } catch (e: any) {
      results.push(`user table insert test FAILED: ${e.message}`);
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message, results },
      { status: 500 }
    );
  }
}

// GET /api/setup — returns full DB debug info
export async function GET() {
  try {
    // Show which DB host the app is actually connecting to
    const dbUrl = process.env.DATABASE_URL || 'NOT SET';
    const dbHost = dbUrl.replace(/:[^:@]*@/, ':***@').split('?')[0]; // hide password

    const [users, crops, roles] = await Promise.all([
      sql`
        SELECT id, name, email, role, role_id, latitude, longitude, location
        FROM "user"
        ORDER BY "createdAt" DESC
        LIMIT 50
      `.catch(() => []),
      sql`
        SELECT c.id, c.user_id, c.crop_name, c.crop_type, u.email, u.name, u.role
        FROM crops c
        LEFT JOIN "user" u ON c.user_id = u.id
        ORDER BY c.created_at DESC
        LIMIT 50
      `.catch(() => []),
      sql`SELECT * FROM roles ORDER BY id`.catch(() => []),
    ]);

    return NextResponse.json({ db_host: dbHost, users, crops, roles });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/setup — removes ALL users and their data
export async function DELETE() {
  try {
    await sql`DELETE FROM reel_likes`.catch(() => {});
    await sql`DELETE FROM reel_comments`.catch(() => {});
    await sql`DELETE FROM reels`.catch(() => {});
    await sql`DELETE FROM messages`.catch(() => {});
    await sql`DELETE FROM follows`.catch(() => {});
    await sql`DELETE FROM favorites`.catch(() => {});
    await sql`DELETE FROM reservations`.catch(() => {});
    await sql`DELETE FROM reviews`.catch(() => {});
    await sql`DELETE FROM crops`.catch(() => {});
    await sql`DELETE FROM machinery_unavailability`.catch(() => {});
    await sql`DELETE FROM machinery`.catch(() => {});
    await sql`DELETE FROM password_reset_tokens`.catch(() => {});
    await sql`DELETE FROM session`.catch(() => {});
    await sql`DELETE FROM account`.catch(() => {});
    await sql`DELETE FROM "user"`.catch(() => {});

    return NextResponse.json({ success: true, message: 'All users and data deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

