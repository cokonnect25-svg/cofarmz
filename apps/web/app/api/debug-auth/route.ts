import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// Test if HMAC verification works exactly like better-call does
async function verifyCookieSignature(signedValue: string, signature: string, secret: string): Promise<boolean> {
  try {
    const algorithm = { name: "HMAC", hash: "SHA-256" };
    const secretBuf = new TextEncoder().encode(secret);
    const key = await crypto.subtle.importKey("raw", secretBuf, algorithm, false, ["verify"]);
    // signature is standard base64 (btoa output)
    const signatureBinStr = atob(signature);
    const sigBytes = new Uint8Array(signatureBinStr.length);
    for (let i = 0; i < signatureBinStr.length; i++) sigBytes[i] = signatureBinStr.charCodeAt(i);
    return await crypto.subtle.verify(algorithm, key, sigBytes, new TextEncoder().encode(signedValue));
  } catch (e: any) {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.BETTER_AUTH_SECRET || "";
  const cookieHeader = req.headers.get("cookie") || "";

  // Parse cookies manually
  const cookieMap: Record<string, string> = {};
  cookieHeader.split(";").forEach(c => {
    const eqIdx = c.indexOf("=");
    if (eqIdx === -1) return;
    const k = c.slice(0, eqIdx).trim();
    const v = c.slice(eqIdx + 1).trim();
    cookieMap[k] = v;
  });

  const cookieNames = Object.keys(cookieMap);

  // Find the session cookie (any variant)
  const sessionCookieNames = [
    "__Secure-better-auth.session_token",
    "better-auth.session_token",
  ];

  let rawCookieValue: string | null = null;
  let foundCookieName: string | null = null;
  for (const name of sessionCookieNames) {
    if (cookieMap[name]) {
      rawCookieValue = cookieMap[name];
      foundCookieName = name;
      break;
    }
  }

  let decodedValue: string | null = null;
  let token: string | null = null;
  let signature: string | null = null;
  let signatureValid: boolean | null = null;
  let sessionFromDb: any = null;
  let verifyError: string | null = null;

  if (rawCookieValue) {
    try {
      decodedValue = decodeURIComponent(rawCookieValue);
    } catch {
      decodedValue = rawCookieValue;
    }

    const lastDot = decodedValue.lastIndexOf(".");
    if (lastDot > 0) {
      token = decodedValue.substring(0, lastDot);
      signature = decodedValue.substring(lastDot + 1);

      // Check signature format (must be 44 chars ending in =)
      const formatOk = signature.length === 44 && signature.endsWith("=");

      try {
        signatureValid = await verifyCookieSignature(token, signature, secret);
      } catch (e: any) {
        verifyError = e.message;
      }

      // Look up session in DB
      try {
        const res = await sql`SELECT id, "userId", "expiresAt" FROM session WHERE token = ${token} LIMIT 1`;
        sessionFromDb = res[0] || null;
      } catch (e: any) {
        sessionFromDb = { error: (e as Error).message };
      }
    }
  }

  // Also call better-auth's get-session directly via fetch (same request cookies)
  let betterAuthSession: any = null;
  try {
    const res = await fetch(`${process.env.BETTER_AUTH_URL}/api/auth/get-session`, {
      headers: { cookie: cookieHeader },
    });
    betterAuthSession = await res.json();
  } catch (e: any) {
    betterAuthSession = { fetchError: (e as Error).message };
  }

  return NextResponse.json({
    secretLength: secret.length,
    secretPrefix: secret.substring(0, 8) + "...",
    cookieHeaderLength: cookieHeader.length,
    cookieNames,
    foundCookieName,
    rawCookieValueLength: rawCookieValue?.length,
    rawCookiePrefix: rawCookieValue?.substring(0, 30),
    decodedValue: decodedValue ? decodedValue.substring(0, 60) + "..." : null,
    tokenLength: token?.length,
    signatureLength: signature?.length,
    signatureEndsWithEq: signature?.endsWith("="),
    signatureValid,
    verifyError,
    sessionFromDb,
    betterAuthSession,
  });
}
