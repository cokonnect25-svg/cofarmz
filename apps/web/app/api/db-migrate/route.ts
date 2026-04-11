import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, string> = {};

  // Create user table (better-auth v1 schema)
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "user" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
        image TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    results.user = 'ok';
  } catch (e: any) { results.user = e.message; }

  // Ensure emailVerified column exists (in case table existed without it)
  try {
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE`;
    results.userEmailVerified = 'ok';
  } catch (e: any) { results.userEmailVerified = e.message; }

  // Create session table with better-auth v1 schema
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        "expiresAt" TIMESTAMP NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    results.session = 'ok';
  } catch (e: any) { results.session = e.message; }

  // Create account table with better-auth v1 schema
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        password TEXT,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "accessTokenExpiresAt" TIMESTAMP,
        "refreshTokenExpiresAt" TIMESTAMP,
        scope TEXT,
        "idToken" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    results.account = 'ok';
  } catch (e: any) { results.account = e.message; }

  // Create verification table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `;
    results.verification = 'ok';
  } catch (e: any) { results.verification = e.message; }

  // Check tables exist and row counts
  try {
    const userCount = await sql`SELECT COUNT(*) as c FROM "user"`;
    const sessionCount = await sql`SELECT COUNT(*) as c FROM session`;
    const accountCount = await sql`SELECT COUNT(*) as c FROM account`;
    results.userRows = userCount[0].c;
    results.sessionRows = sessionCount[0].c;
    results.accountRows = accountCount[0].c;
  } catch (e: any) { results.counts = e.message; }

  // Check user table columns
  try {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user'
      ORDER BY ordinal_position
    `;
    results.userColumns = cols.map((c: any) => c.column_name).join(', ');
  } catch (e: any) { results.userColumnsErr = e.message; }

  // Check if account table has credentials for test user
  try {
    const accounts = await sql`SELECT "accountId", "providerId" FROM account LIMIT 5`;
    results.accounts = JSON.stringify(accounts);
  } catch (e: any) { results.accountsErr = e.message; }

  return NextResponse.json(results);
}
