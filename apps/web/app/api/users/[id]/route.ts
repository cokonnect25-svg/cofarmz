import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await sql`SELECT * FROM "user" WHERE id = ${id}`;
    
    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('GET /api/users/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
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
    const { name, email, image, location, latitude, longitude } = body;

    console.log('PUT /api/users/[id] - Updating user:', { id, hasImage: !!image, name, email });

    // Check if user exists
    const existingUser = await sql`SELECT * FROM "user" WHERE id = ${id}`;
    if (existingUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('User found, updating...', existingUser[0]);

    // Update user (at least image must be provided)
    let result;
    if (image !== undefined) {
      result = await sql`
        UPDATE "user" 
        SET 
          image = ${image},
          name = ${name !== undefined ? name : existingUser[0].name},
          email = ${email !== undefined ? email : existingUser[0].email},
          location = ${location !== undefined ? location : existingUser[0].location},
          latitude = ${latitude !== undefined ? latitude : existingUser[0].latitude},
          longitude = ${longitude !== undefined ? longitude : existingUser[0].longitude},
          "updatedAt" = ${new Date().toISOString()}
        WHERE id = ${id}
        RETURNING *
      `;
    } else {
      result = await sql`
        UPDATE "user" 
        SET 
          name = ${name !== undefined ? name : existingUser[0].name},
          email = ${email !== undefined ? email : existingUser[0].email},
          location = ${location !== undefined ? location : existingUser[0].location},
          latitude = ${latitude !== undefined ? latitude : existingUser[0].latitude},
          longitude = ${longitude !== undefined ? longitude : existingUser[0].longitude},
          "updatedAt" = ${new Date().toISOString()}
        WHERE id = ${id}
        RETURNING *
      `;
    }

    console.log('Update result:', result);

    if (result.length === 0) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('PUT /api/users/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to update user', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
