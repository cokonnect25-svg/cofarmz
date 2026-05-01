import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// Reads the Better Auth session cookie directly and queries the DB.
// Used as fallback when authClient.getSession() fails due to broken session route.
export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    if (!cookieHeader) return NextResponse.json(null);

    // Better Auth uses these cookie names
    const cookieNames = [
      "__Secure-better-auth.session_token",
      "better-auth.session_token",
    ];

    let rawValue: string | null = null;
    for (const name of cookieNames) {
      const match = cookieHeader
        .split(";")
        .find(c => c.trim().startsWith(name + "="));
      if (match) {
        rawValue = decodeURIComponent(match.trim().substring(name.length + 1));
        break;
      }
    }

    if (!rawValue) return NextResponse.json(null);

    // Cookie format: "token.signature" — extract token (part before last dot)
    const lastDot = rawValue.lastIndexOf(".");
    const token = lastDot > 0 ? rawValue.substring(0, lastDot) : rawValue;
    if (!token) return NextResponse.json(null);

    const rows = await sql`
      SELECT
        u.id, u.name, u.email, u.image,
        u.role, u.role_id, u.role_confirmed
      FROM session s
      JOIN "user" u ON u.id = s."userId"
      WHERE s.token = ${token}
        AND s."expiresAt" > NOW()
      LIMIT 1
    `;

    if (!rows.length) return NextResponse.json(null);

    const u = rows[0];
    return NextResponse.json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        role: u.role?.toLowerCase(),
        role_id: u.role_id,
        role_confirmed: u.role_confirmed,
      },
    });
  } catch {
    return NextResponse.json(null);
  }
}
