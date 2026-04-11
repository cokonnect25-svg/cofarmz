import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    // Ensure table and columns exist before querying
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
      created_at TIMESTAMP DEFAULT NOW()
    )`.catch(() => {});
    await sql`ALTER TABLE crops ADD COLUMN IF NOT EXISTS crop_type VARCHAR(20) DEFAULT 'grow'`.catch(() => {});
    await sql`ALTER TABLE crops ADD COLUMN IF NOT EXISTS is_crop_waste BOOLEAN DEFAULT false`.catch(() => {});
    await sql`ALTER TABLE crops DROP CONSTRAINT IF EXISTS crops_crop_type_check`.catch(() => {});

    const crops = await sql`
      SELECT id, crop_name, years_of_experience, expertise_level, expected_yield_date, expected_yield_quantity, expected_yield_quantity_uom, is_crop_waste, crop_type, created_at
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
    const { user_id, crop_name, years_of_experience, expertise_level, expected_yield_date, expected_yield_quantity, expected_yield_quantity_uom, crop_type, is_crop_waste } = await request.json();

    if (!user_id || !crop_name) {
      return NextResponse.json(
        { error: 'user_id and crop_name are required' },
        { status: 400 }
      );
    }
    const trimmedCropName = crop_name.trim();

    // Ensure optional columns exist (in case table was created before these were added)
    await sql`ALTER TABLE crops ADD COLUMN IF NOT EXISTS crop_type VARCHAR(20) DEFAULT 'grow'`.catch(() => {});
    await sql`ALTER TABLE crops ADD COLUMN IF NOT EXISTS is_crop_waste BOOLEAN DEFAULT false`.catch(() => {});
    // Drop restrictive check constraint so 'buy' and other values are allowed
    await sql`ALTER TABLE crops DROP CONSTRAINT IF EXISTS crops_crop_type_check`.catch(() => {});

    const result = await sql`
      INSERT INTO crops (user_id, crop_name, years_of_experience, expertise_level, expected_yield_date, expected_yield_quantity, expected_yield_quantity_uom, crop_type, is_crop_waste)
      VALUES (${user_id}, ${trimmedCropName}, ${years_of_experience || null}, ${expertise_level || 'Beginner'}, ${expected_yield_date || null}, ${expected_yield_quantity || null}, ${expected_yield_quantity_uom || 'kg'}, ${crop_type || 'grow'}, ${is_crop_waste || false})
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
    const { id, crop_name, years_of_experience, expertise_level, expected_yield_date, expected_yield_quantity, expected_yield_quantity_uom, crop_type, is_crop_waste } = await request.json();

    if (!id || !crop_name) {
      return NextResponse.json(
        { error: 'id and crop_name are required' },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE crops 
      SET crop_name = ${crop_name}, 
          years_of_experience = ${years_of_experience || null}, 
          expertise_level = ${expertise_level || 'Beginner'},
          expected_yield_date = ${expected_yield_date || null},
          expected_yield_quantity = ${expected_yield_quantity || null},
          expected_yield_quantity_uom = ${expected_yield_quantity_uom || 'kg'},
          crop_type = ${crop_type || 'grow'},
          is_crop_waste = ${is_crop_waste || false}
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating crop:', error);
    return NextResponse.json({ error: 'Failed to update crop' }, { status: 500 });
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
  } catch (error) {
    console.error('Error deleting crop:', error);
    return NextResponse.json({ error: 'Failed to delete crop' }, { status: 500 });
  }
}
