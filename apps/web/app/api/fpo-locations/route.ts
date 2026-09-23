import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';
import { fpoError } from '@/lib/fpo-access';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return NextResponse.json(await sql`SELECT state,district FROM fpo_districts ORDER BY state,district`); }
  catch(e) { return fpoError(e); }
}
