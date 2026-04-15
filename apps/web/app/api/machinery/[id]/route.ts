export const dynamic = 'force-dynamic';
import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await sql`SELECT * FROM machinery WHERE id = ${id}`;
    
    if (result.length === 0) {
      return NextResponse.json({ error: 'Machinery not found' }, { status: 404 });
    }
    
    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('GET /api/machinery/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch machinery' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, model, year, power, drive, fuel, daily_rate, description, image_url, images, location, contact_phone } = body;

    // Ensure images column exists
    await sql`ALTER TABLE machinery ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'`.catch(() => {});

    const imagesJson = Array.isArray(images) && images.length > 0
      ? JSON.stringify(images)
      : '[]';

    const finalImageUrl = image_url || null;

    const result = await sql`
      UPDATE machinery
      SET
        name = COALESCE(${name}, name),
        model = COALESCE(${model}, model),
        year = COALESCE(${year ?? null}, year),
        power = COALESCE(${power ?? null}, power),
        drive = COALESCE(${drive ?? null}, drive),
        fuel = COALESCE(${fuel ?? null}, fuel),
        daily_rate = COALESCE(${daily_rate ?? null}, daily_rate),
        description = ${description ?? null},
        image_url = COALESCE(${finalImageUrl}, image_url),
        images = ${imagesJson}::jsonb,
        location = COALESCE(${location ?? null}, location),
        contact_phone = COALESCE(${contact_phone ?? null}, contact_phone)
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Machinery not found' }, { status: 404 });
    }

    console.log('[PUT /api/machinery/[id]] Updated machinery:', {
      id: result[0].id,
      name: result[0].name,
      image_url_length: result[0].image_url?.length || 0,
      has_image: !!result[0].image_url,
    });

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('PUT /api/machinery/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to update machinery' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { is_unavailable } = await request.json();
    const result = await sql`
      UPDATE machinery SET is_unavailable = ${is_unavailable} WHERE id = ${id} RETURNING *
    `;
    if (result.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('PATCH /api/machinery/[id]:', error);
    return NextResponse.json({ error: 'Failed to update availability' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await sql`DELETE FROM reservations WHERE machinery_id = ${id}`.catch(() => {});
    const result = await sql`DELETE FROM machinery WHERE id = ${id} RETURNING id`;
    if (result.length === 0) {
      return NextResponse.json({ error: 'Machinery not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/machinery/[id]:', error);
    return NextResponse.json({ error: 'Failed to delete machinery' }, { status: 500 });
  }
}
