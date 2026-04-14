export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import bcrypt from 'bcrypt';

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { message: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Verify token
    const resetToken = await sql`
      SELECT user_id FROM password_reset_tokens 
      WHERE token = ${token} AND expires_at > ${new Date()}
    `;

    if (resetToken.length === 0) {
      return NextResponse.json(
        { message: 'Reset link has expired or is invalid' },
        { status: 400 }
      );
    }

    const userId = resetToken[0].user_id;

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password
    await sql`
      UPDATE "user" SET password = ${hashedPassword} WHERE id = ${userId}
    `;

    // Delete used token
    await sql`
      DELETE FROM password_reset_tokens WHERE user_id = ${userId}
    `;

    return NextResponse.json(
      { message: 'Password reset successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { message: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

