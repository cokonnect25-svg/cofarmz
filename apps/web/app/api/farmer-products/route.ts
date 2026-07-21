import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function ensureSchema() {
  await sql`CREATE TABLE IF NOT EXISTS farmer_products (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    price NUMERIC(12, 2) NOT NULL,
    unit VARCHAR(30) NOT NULL DEFAULT 'kg',
    quantity NUMERIC(12, 2),
    image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS farmer_products_user_id_idx ON farmer_products(user_id)`;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const userId = params.get('userId');
  const search = params.get('search')?.trim() || '';

  try {
    await ensureSchema();
    const products = userId
      ? await sql`
          SELECT p.id, p.user_id, p.name, p.category, p.description, p.price, p.unit,
                 p.quantity, p.image_url, p.created_at, p.updated_at,
                 u.name AS farmer_name, u.location AS farmer_location, u.image AS farmer_image
          FROM farmer_products p
          LEFT JOIN "user" u ON u.id = p.user_id
          WHERE p.user_id = ${userId}
          ORDER BY p.created_at DESC
        `
      : await sql`
          SELECT p.id, p.user_id, p.name, p.category, p.description, p.price, p.unit,
                 p.quantity, p.image_url, p.created_at, p.updated_at,
                 u.name AS farmer_name, u.location AS farmer_location, u.image AS farmer_image
          FROM farmer_products p
          LEFT JOIN "user" u ON u.id = p.user_id
          WHERE ${search} = ''
             OR p.name ILIKE ${`%${search}%`}
             OR COALESCE(p.category, '') ILIKE ${`%${search}%`}
             OR COALESCE(p.description, '') ILIKE ${`%${search}%`}
             OR COALESCE(u.name, '') ILIKE ${`%${search}%`}
             OR COALESCE(u.location, '') ILIKE ${`%${search}%`}
          ORDER BY p.created_at DESC
        `;
    return NextResponse.json(products);
  } catch (error: any) {
    console.error('Error fetching farmer products:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    const userId = String(body.user_id || '').trim();
    const price = Number(body.price);
    const quantity = body.quantity === '' || body.quantity == null ? null : Number(body.quantity);

    if (!userId || !name) {
      return NextResponse.json({ error: 'Product name and user are required' }, { status: 400 });
    }
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'Enter a valid product price' }, { status: 400 });
    }
    if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
      return NextResponse.json({ error: 'Enter a valid quantity' }, { status: 400 });
    }

    await ensureSchema();
    const result = await sql`
      INSERT INTO farmer_products
        (user_id, name, category, description, price, unit, quantity, image_url)
      VALUES
        (${userId}, ${name}, ${body.category || null}, ${body.description || null},
         ${price}, ${body.unit || 'kg'}, ${quantity}, ${body.image_url || null})
      RETURNING *
    `;
    return NextResponse.json(result[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating farmer product:', error);
    return NextResponse.json({ error: error?.message || 'Failed to add product' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = Number(params.get('id'));
  const userId = params.get('userId');
  if (!Number.isInteger(id) || !userId) {
    return NextResponse.json({ error: 'Product id and userId are required' }, { status: 400 });
  }

  try {
    await ensureSchema();
    const deleted = await sql`
      DELETE FROM farmer_products WHERE id = ${id} AND user_id = ${userId} RETURNING id
    `;
    if (!deleted.length) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting farmer product:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete product' }, { status: 500 });
  }
}
