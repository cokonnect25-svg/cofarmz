import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    db: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'NOT SET',
    auth_url: process.env.BETTER_AUTH_URL || 'NOT SET',
    node_env: process.env.NODE_ENV,
  });
}
