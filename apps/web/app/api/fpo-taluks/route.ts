import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';
import { validateDistrict } from '@/lib/fpo-location';
import { fpoError } from '@/lib/fpo-access';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    const district = await validateDistrict(q.get('state'),q.get('district'));
    return NextResponse.json(await sql`SELECT id,name FROM fpo_taluks WHERE district_id=${district.id} ORDER BY name`);
  } catch (e) { return fpoError(e); }
}
