import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Read all cookies
    const cookieHeader = req.headers.get('cookie') || '';
    const cookies: Record<string, string> = {};
    cookieHeader.split(';').forEach(c => {
      const [k, ...v] = c.trim().split('=');
      if (k) cookies[k.trim()] = v.join('=');
    });

    // Find the better-auth session cookie (try multiple names)
    const sessionCookieNames = [
      '__Secure-better-auth.session_token',
      'better-auth.session_token',
      '__Host-better-auth.session_token',
    ];
    let rawCookieValue: string | null = null;
    let cookieName: string | null = null;
    for (const name of sessionCookieNames) {
      if (cookies[name]) {
        rawCookieValue = cookies[name];
        cookieName = name;
        break;
      }
    }

    // Check what tables exist
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('session', 'account', 'user', 'verification')
      ORDER BY table_name
    `;

    // Check user table columns
    const userCols = await sql`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user'
      ORDER BY ordinal_position
    `;

    // Check session table columns
    const sessionCols = await sql`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'session'
      ORDER BY ordinal_position
    `;

    // Count sessions
    let sessionCount = 0;
    let recentSessions: any[] = [];
    try {
      const countResult = await sql`SELECT COUNT(*) as count FROM session`;
      sessionCount = parseInt(countResult[0].count);
      recentSessions = await sql`SELECT token, "userId", "expiresAt", "createdAt" FROM session ORDER BY "createdAt" DESC LIMIT 3`;
    } catch (e: any) {
      return NextResponse.json({ tableColumns: { user: userCols, session: sessionCols }, sessionError: e.message });
    }

    // Try to find session by cookie token (exact match)
    let sessionByToken: any = null;
    let tokenLookupMethod = 'none';
    if (rawCookieValue) {
      // better-auth cookie format: "token.hmacSignature" — token is the part before the last dot
      // Try: full value as token
      try {
        const res = await sql`SELECT id, "userId", "expiresAt" FROM session WHERE token = ${rawCookieValue} LIMIT 1`;
        if (res.length > 0) {
          sessionByToken = res[0];
          tokenLookupMethod = 'full_value';
        }
      } catch {}

      // Try: part before first dot
      if (!sessionByToken && rawCookieValue.includes('.')) {
        const tokenPart = rawCookieValue.split('.')[0];
        try {
          const res = await sql`SELECT id, "userId", "expiresAt" FROM session WHERE token = ${tokenPart} LIMIT 1`;
          if (res.length > 0) {
            sessionByToken = res[0];
            tokenLookupMethod = 'before_first_dot';
          }
        } catch {}
      }

      // Try: part before last dot
      if (!sessionByToken && rawCookieValue.includes('.')) {
        const lastDot = rawCookieValue.lastIndexOf('.');
        const tokenPart = rawCookieValue.substring(0, lastDot);
        try {
          const res = await sql`SELECT id, "userId", "expiresAt" FROM session WHERE token = ${tokenPart} LIMIT 1`;
          if (res.length > 0) {
            sessionByToken = res[0];
            tokenLookupMethod = 'before_last_dot';
          }
        } catch {}
      }
    }

    return NextResponse.json({
      tables: tables.map(t => t.table_name),
      userColumns: userCols.map((c: any) => `${c.column_name}:${c.data_type}`),
      sessionColumns: sessionCols.map((c: any) => `${c.column_name}:${c.data_type}`),
      sessionCount,
      cookieFound: !!rawCookieValue,
      cookieName,
      cookieValuePrefix: rawCookieValue ? rawCookieValue.substring(0, 20) + '...' : null,
      sessionByToken: sessionByToken ? { userId: sessionByToken.userId, expiresAt: sessionByToken.expiresAt } : null,
      tokenLookupMethod,
      recentSessions: recentSessions.map(s => ({
        tokenPrefix: s.token?.substring(0, 15),
        userId: s.userId,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
