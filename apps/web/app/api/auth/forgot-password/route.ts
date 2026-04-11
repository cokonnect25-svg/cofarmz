import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { randomBytes } from 'crypto';

// For development: simple console-based email simulation
async function sendResetEmail(email: string, resetLink: string) {
  try {
    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n========== PASSWORD RESET EMAIL ==========`);
      console.log(`To: ${email}`);
      console.log(`Reset Link: ${resetLink}`);
      console.log(`==========================================\n`);
      return true;
    }

    // In production, you can integrate with:
    // - SendGrid, Mailgun, Resend, AWS SES, etc.
    // For now, we'll just log it
    console.log(`Password reset email would be sent to: ${email}`);
    console.log(`Reset link: ${resetLink}`);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { message: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await sql`
      SELECT id, email FROM "user" WHERE email = ${email}
    `;

    if (user.length === 0) {
      // Don't reveal if email exists (security best practice)
      return NextResponse.json(
        { message: 'If an account with that email exists, a reset link has been sent' },
        { status: 200 }
      );
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store reset token in database
    await sql`
      INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
      VALUES (${user[0].id}, ${resetToken}, ${expiresAt}, ${new Date()})
      ON CONFLICT (user_id) DO UPDATE SET 
        token = ${resetToken}, 
        expires_at = ${expiresAt},
        created_at = ${new Date()}
    `;

    // Create reset link
    const resetLink = `${process.env.NEXT_PUBLIC_BACKEND_URL}/reset-password?token=${resetToken}`;

    // Send email
    await sendResetEmail(email, resetLink);

    return NextResponse.json(
      { message: 'Reset link has been sent to your email' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { message: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
