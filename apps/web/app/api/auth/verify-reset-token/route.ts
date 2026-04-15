import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { message: 'Token is required' },
        { status: 400 }
      );
    }

    // Check if token exists and is not expired
    const resetToken = await sql`
      SELECT user_id, expires_at FROM password_reset_tokens 
      WHERE token = ${token} AND expires_at > ${new Date()}
    `;

    if (resetToken.length === 0) {
      return NextResponse.json(
        { message: 'Reset link has expired or is invalid' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: 'Valid token', userId: resetToken[0].user_id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Verify token error:', error);
    return NextResponse.json(
      { message: 'An error occurred while verifying token' },
      { status: 500 }
    );
  }
}
