import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import sql from '@/app/api/utils/sql';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID_MOBILE);

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Token missing' },
        { status: 400 }
      );
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID_MOBILE,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      return NextResponse.json(
        { success: false, message: 'Invalid token payload' },
        { status: 400 }
      );
    }

    const email = payload.email;
    const name = payload.name || '';

    // 🔥 Find or create user
    let user = await sql`
      SELECT * FROM "user" WHERE email = ${email}
    `;

    if (user.length === 0) {
      user = await sql`
        INSERT INTO "user" (email, name)
        VALUES (${email}, ${name})
        RETURNING *
      `;
    }

    // 🔥 TODO: create session / JWT here

    return NextResponse.json({
      success: true,
      user: user[0],
    });

  } catch (error) {
    console.error('Mobile Google login error:', error);

    return NextResponse.json(
      { success: false, message: 'Authentication failed' },
      { status: 500 }
    );
  }
}