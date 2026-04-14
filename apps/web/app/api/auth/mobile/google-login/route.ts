import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import sql from '@/app/api/utils/sql';
import { randomUUID } from 'crypto';

// Accept tokens issued for either the mobile web client or the main web client.
// This handles old APKs (old client ID) and new APKs (new client ID) without breaking.
function getValidAudiences(): string[] {
  return [
    process.env.GOOGLE_CLIENT_ID_MOBILE,
    process.env.GOOGLE_CLIENT_ID,
  ].filter(Boolean) as string[];
}

const client = new OAuth2Client();

/**
 * Sign a cookie value using HMAC-SHA256 — must match better-call's signCookieValue:
 * encodeURIComponent(`${value}.${base64(HMAC-SHA256(value, secret))}`)
 */
async function signCookieValue(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  const base64Sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return encodeURIComponent(`${value}.${base64Sig}`);
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ success: false, message: 'Token missing' }, { status: 400 });
    }

    const audiences = getValidAudiences();
    if (audiences.length === 0) {
      console.error('GOOGLE_CLIENT_ID_MOBILE env var is not set');
      return NextResponse.json({ success: false, message: 'Server misconfiguration' }, { status: 500 });
    }

    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: audiences,
      });
      payload = ticket.getPayload();
    } catch (verifyErr: any) {
      console.error('Token verification failed:', verifyErr?.message);
      return NextResponse.json(
        { success: false, message: `Token verification failed: ${verifyErr?.message}` },
        { status: 401 }
      );
    }

    if (!payload?.email) {
      return NextResponse.json({ success: false, message: 'Invalid token payload' }, { status: 400 });
    }

    const email = payload.email;
    const name = payload.name || email.split('@')[0];
    const picture = payload.picture || null;

    // Find or create user in better-auth's user table
    let userRows = await sql`SELECT * FROM "user" WHERE email = ${email}`;

    if (userRows.length === 0) {
      const userId = randomUUID();
      userRows = await sql`
        INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt", image)
        VALUES (${userId}, ${email}, ${name}, true, now(), now(), ${picture})
        RETURNING *
      `;
    }

    const user = userRows[0];

    // Create a session record in better-auth's session table
    const sessionToken = randomUUID();
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await sql`
      INSERT INTO session (id, "userId", token, "expiresAt", "createdAt", "updatedAt")
      VALUES (${sessionId}, ${user.id}, ${sessionToken}, ${expiresAt}, now(), now())
    `;

    // Sign the session token using the same algorithm as better-auth/better-call
    const secret = process.env.BETTER_AUTH_SECRET!;
    if (!secret) {
      console.error('BETTER_AUTH_SECRET env var is not set');
      return NextResponse.json({ success: false, message: 'Server misconfiguration' }, { status: 500 });
    }
    const signedToken = await signCookieValue(sessionToken, secret);

    // Cookie name = prefix + ".session_token" (matches auth.ts cookiePrefix: "cofarmz")
    const cookieName = 'cofarmz.session_token';
    const isProduction = process.env.NODE_ENV === 'production';
    const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
    const cookieStr = [
      `${cookieName}=${signedToken}`,
      'Path=/',
      `Max-Age=${maxAge}`,
      'SameSite=Lax',
      'HttpOnly',
      ...(isProduction ? ['Secure'] : []),
    ].join('; ');

    // Return signedToken in body so Capacitor client can set it explicitly via CapacitorCookies
    const response = NextResponse.json({ success: true, user, signedToken });
    response.headers.append('Set-Cookie', cookieStr);
    return response;

  } catch (error: any) {
    console.error('Mobile Google login error:', error?.message, error?.stack);
    return NextResponse.json(
      { success: false, message: error?.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}
