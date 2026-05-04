import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// ─── ensure schema is up to date ─────────────────────────────────────────────
async function ensureSchema() {
  await sql`CREATE TABLE IF NOT EXISTS crops (
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
    certificate_url TEXT,
    grade VARCHAR(10),
    certification_type VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`.catch(() => {});

  await sql`ALTER TABLE crops ADD COLUMN IF NOT EXISTS crop_type VARCHAR(20) DEFAULT 'grow'`.catch(() => {});
  await sql`ALTER TABLE crops ADD COLUMN IF NOT EXISTS is_crop_waste BOOLEAN DEFAULT false`.catch(() => {});
  await sql`ALTER TABLE crops ADD COLUMN IF NOT EXISTS certificate_url TEXT`.catch(() => {});
  await sql`ALTER TABLE crops ADD COLUMN IF NOT EXISTS grade VARCHAR(10)`.catch(() => {});
  await sql`ALTER TABLE crops ADD COLUMN IF NOT EXISTS certification_type VARCHAR(50) DEFAULT NULL`.catch(() => {});
  await sql`ALTER TABLE crops DROP CONSTRAINT IF EXISTS crops_crop_type_check`.catch(() => {});
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // BUG FIX 1: support both param names used across the codebase
  const userId = searchParams.get('userId') || searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    await ensureSchema();

    const crops = await sql`
      SELECT
        id, crop_name, years_of_experience, expertise_level,
        expected_yield_date, expected_yield_quantity, expected_yield_quantity_uom,
        is_crop_waste, crop_type, certification_type, certificate_url, grade, created_at
      FROM crops
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    return NextResponse.json(crops);
  } catch (error: any) {
    console.error('Error fetching crops:', error);
    return NextResponse.json({ error: `Failed to fetch crops: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      user_id, crop_name, years_of_experience, expertise_level,
      expected_yield_date, expected_yield_quantity, expected_yield_quantity_uom,
      crop_type, is_crop_waste, certificate_url, grade,
    } = body;

    // BUG FIX 2: normalise certification_type — empty string → null
    const certification_type = body.certification_type || null;

    if (!user_id || !crop_name) {
      return NextResponse.json({ error: 'user_id and crop_name are required' }, { status: 400 });
    }

    if (expected_yield_quantity !== null && expected_yield_quantity !== undefined) {
      if (isNaN(expected_yield_quantity) || expected_yield_quantity <= 0) {
        return NextResponse.json({ error: 'Invalid quantity value' }, { status: 400 });
      }
    }

    if (years_of_experience !== null && years_of_experience !== undefined) {
      if (years_of_experience < 0) {
        return NextResponse.json({ error: 'Invalid experience value' }, { status: 400 });
      }
    }

    const trimmedCropName = crop_name.trim();

    await ensureSchema();

    const existing = await sql`
      SELECT id FROM crops
      WHERE user_id = ${user_id}
      AND LOWER(crop_name) = LOWER(${trimmedCropName})
    `;

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Crop already exists for this user' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO crops (
        user_id, crop_name, years_of_experience, expertise_level,
        expected_yield_date, expected_yield_quantity, expected_yield_quantity_uom,
        crop_type, is_crop_waste, certificate_url, grade, certification_type
      )
      VALUES (
        ${user_id},
        ${trimmedCropName},
        ${years_of_experience ?? null},
        ${expertise_level || 'Beginner'},
        ${expected_yield_date || null},
        ${expected_yield_quantity ?? null},
        ${expected_yield_quantity_uom || 'kg'},
        ${crop_type || 'grow'},
        ${is_crop_waste ?? false},
        ${certificate_url || null},
        ${grade || null},
        ${certification_type}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error: any) {
    console.error('Error creating crop:', error);
    return NextResponse.json({ error: `Failed to create crop: ${error.message}` }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id, crop_name, years_of_experience, expertise_level,
      expected_yield_date, expected_yield_quantity, expected_yield_quantity_uom,
      crop_type, is_crop_waste, certificate_url, grade,
    } = body;

    // BUG FIX 2: normalise certification_type — empty string → null
    const certification_type = body.certification_type || null;

    if (!id || !crop_name) {
      return NextResponse.json({ error: 'id and crop_name are required' }, { status: 400 });
    }

    const trimmedCropName = crop_name.trim();

    await ensureSchema();

    const cropRow = await sql`SELECT user_id FROM crops WHERE id = ${parseInt(id)}`;

    if (cropRow.length === 0) {
      return NextResponse.json({ error: 'Crop not found' }, { status: 404 });
    }

    const user_id = cropRow[0].user_id;

    const existing = await sql`
      SELECT id FROM crops
      WHERE user_id = ${user_id}
      AND LOWER(crop_name) = LOWER(${trimmedCropName})
      AND id != ${parseInt(id)}
    `;

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Crop already exists' }, { status: 400 });
    }

    const result = await sql`
      UPDATE crops
      SET
        crop_name             = ${trimmedCropName},
        years_of_experience   = ${years_of_experience ?? null},
        expertise_level       = ${expertise_level || 'Beginner'},
        expected_yield_date   = ${expected_yield_date || null},
        expected_yield_quantity     = ${expected_yield_quantity ?? null},
        expected_yield_quantity_uom = ${expected_yield_quantity_uom || 'kg'},
        crop_type             = ${crop_type || 'grow'},
        is_crop_waste         = ${is_crop_waste ?? false},
        certificate_url       = ${certificate_url || null},
        grade                 = ${grade || null},
        certification_type    = ${certification_type}
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error: any) {
    console.error('Error updating crop:', error);
    return NextResponse.json({ error: `Failed to update crop: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  try {
    await sql`DELETE FROM crops WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting crop:', error);
    return NextResponse.json({ error: 'Failed to delete crop' }, { status: 500 });
  }
}