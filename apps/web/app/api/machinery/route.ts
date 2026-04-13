import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner_id = searchParams.get("owner_id") || searchParams.get("ownerId");

    console.log("GET /api/machinery called, owner_id:", owner_id);

    let query;
    if (owner_id) {
      console.log("Fetching machinery for owner:", owner_id);
      query = await sql`
        SELECT m.*, 
               COALESCE(m.latitude, u.latitude) as latitude, 
               COALESCE(m.longitude, u.longitude) as longitude
        FROM machinery m
        LEFT JOIN "user" u ON m.owner_id = u.id
        WHERE m.owner_id = ${owner_id}
        ORDER BY m.created_at DESC
      `;
    } else {
      console.log("Fetching all machinery");
      query = await sql`
        SELECT m.*, 
               COALESCE(m.latitude, u.latitude) as latitude, 
               COALESCE(m.longitude, u.longitude) as longitude
        FROM machinery m
        LEFT JOIN "user" u ON m.owner_id = u.id
        ORDER BY m.created_at DESC
      `;
    }

    console.log("Query result:", query);

    if (!query || !Array.isArray(query)) {
      console.error("Invalid query response:", query);
      return NextResponse.json([], { status: 200 });
    }

    console.log("Returning machinery data, count:", query.length);
    return NextResponse.json(query);
  } catch (error: any) {
    console.error("Error fetching machinery:", error);
    console.error("Error stack:", error?.stack);
    return NextResponse.json(
      { error: "Failed to fetch machinery", details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('POST /api/machinery received body:', JSON.stringify(body));
    
    const {
      owner_id,
      name,
      model,
      year,
      power,
      drive,
      fuel,
      daily_rate,
      description,
      image_url,
      images,
      location,
      contact_phone,
      latitude,
      longitude,
    } = body;

    // Validate required fields
    if (!owner_id) {
      console.error('Missing owner_id');
      return NextResponse.json(
        { error: "Missing required field: owner_id" },
        { status: 400 }
      );
    }

    if (!name || !name.trim()) {
      console.error('Missing or empty name');
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    if (daily_rate === undefined || daily_rate === null || daily_rate === '') {
      console.error('Missing daily_rate');
      return NextResponse.json(
        { error: "Missing required field: daily_rate" },
        { status: 400 }
      );
    }

    const dailyRateNum = parseFloat(daily_rate);
    if (isNaN(dailyRateNum) || dailyRateNum <= 0) {
      console.error('Invalid daily_rate:', daily_rate);
      return NextResponse.json(
        { error: "daily_rate must be a positive number" },
        { status: 400 }
      );
    }

    const id = randomUUID();
    console.log('Inserting machinery with id:', id, 'owner_id:', owner_id, 'name:', name, 'daily_rate:', dailyRateNum);

    await sql`ALTER TABLE machinery ADD COLUMN IF NOT EXISTS contact_phone TEXT`.catch(() => {});
    await sql`ALTER TABLE machinery ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7)`.catch(() => {});
    await sql`ALTER TABLE machinery ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7)`.catch(() => {});
    await sql`ALTER TABLE machinery ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'`.catch(() => {});

    const imagesJson = JSON.stringify(Array.isArray(images) && images.length > 0 ? images : (image_url ? [image_url] : []));

    const result = await sql`
      INSERT INTO machinery (
        id,
        owner_id,
        name,
        model,
        year,
        power,
        drive,
        fuel,
        daily_rate,
        description,
        image_url,
        images,
        location,
        contact_phone,
        latitude,
        longitude,
        created_at
      ) VALUES (
        ${id},
        ${owner_id},
        ${name.trim()},
        ${model || null},
        ${year ? parseInt(year) : null},
        ${power || null},
        ${drive || null},
        ${fuel || null},
        ${dailyRateNum},
        ${description || null},
        ${image_url || null},
        ${imagesJson}::jsonb,
        ${location || null},
        ${contact_phone || null},
        ${latitude || null},
        ${longitude || null},
        NOW()
      )
      RETURNING *
    `;

    console.log('Machinery created successfully:', result[0]);
    return NextResponse.json(result[0], { status: 201 });
  } catch (error: any) {
    console.error("Error creating machinery:", error.message || error);
    console.error("Full error:", error);
    return NextResponse.json(
      { error: "Failed to create machinery listing: " + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
