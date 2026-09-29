import { getSignedCookieUser } from '@/lib/session-user';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSignedCookieUser(req.headers);
    return NextResponse.json(user ? { user: { ...user, role: user.role?.toLowerCase() } } : null,
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json(null, { headers: { 'Cache-Control': 'private, no-store' } });
  }
}
