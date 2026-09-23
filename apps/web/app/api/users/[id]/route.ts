export const dynamic = 'force-dynamic';
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

export async function PUT(request: Request, {params}: {params: Promise<{id:string}>}) {
  const {id} = await params;
  const body = await request.json();
  const {PUT: updateProfile} = await import('../profile/route');
  return updateProfile(new Request(request.url, {method:'PUT',headers:request.headers,body:JSON.stringify({...body,userId:id})}));
}
