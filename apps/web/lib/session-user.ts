import { createHmac, timingSafeEqual } from 'node:crypto';
import sql from '@/app/api/utils/sql';

// Older mobile clients write an unprefixed cookie even on HTTPS.
// Verify its signature before resolving the live database session.
export async function getSignedCookieUser(headers: Headers) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) return null;
  const cookies = (headers.get('cookie') || '').split(';');
  const values: string[] = [];
  const bearer = headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (bearer) values.push(bearer);
  for (const name of [
    '__Secure-cofarmz.session_token', '__Host-cofarmz.session_token', 'cofarmz.session_token',
    '__Secure-better-auth.session_token', '__Host-better-auth.session_token', 'better-auth.session_token',
  ]) {
    const cookie = cookies.find(value => value.trim().startsWith(`${name}=`));
    if (!cookie) continue;
    values.push(cookie.trim().slice(name.length + 1));
  }
  for (const rawValue of values) {
    let value: string;
    try { value = decodeURIComponent(rawValue); }
    catch { continue; }
    const dot = value.lastIndexOf('.');
    if (dot <= 0) continue;
    const token = value.slice(0, dot);
    const signature = Buffer.from(value.slice(dot + 1));
    const expected = Buffer.from(createHmac('sha256', secret).update(token).digest('base64'));
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) continue;
    const [user] = await sql`
      SELECT u.id, u.name, u.email, u.image, u.role, u.role_id, u.role_confirmed
      FROM session s JOIN "user" u ON u.id = s."userId"
      WHERE s.token = ${token} AND s."expiresAt" > NOW()
      LIMIT 1
    `;
    if (user) return user;
  }
  return null;
}
