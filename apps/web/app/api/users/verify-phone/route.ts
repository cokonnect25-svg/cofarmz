import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function decodeBase64UrlJson(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

function base64UrlToBuffer(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

function normalizePhoneForLookup(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}

async function verifyFirebasePhoneToken(idToken: string) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Firebase project ID is not configured");

  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid Firebase token");

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeBase64UrlJson(encodedHeader);
  const payload = decodeBase64UrlJson(encodedPayload);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported Firebase token header");
  }

  const certRes = await fetch(
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com",
    { cache: "no-store" }
  );
  if (!certRes.ok) throw new Error("Unable to load Firebase public certificates");
  const certs = await certRes.json();
  const cert = certs[header.kid];
  if (!cert) throw new Error("Firebase certificate not found");

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();
  const valid = verifier.verify(cert, base64UrlToBuffer(encodedSignature));
  if (!valid) throw new Error("Firebase token signature is invalid");

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error("Firebase token audience mismatch");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("Firebase token issuer mismatch");
  }
  if (!payload.sub) throw new Error("Firebase token subject is missing");
  if (typeof payload.exp !== "number" || payload.exp <= now) throw new Error("Firebase token expired");
  if (typeof payload.auth_time !== "number") throw new Error("Firebase auth time missing");
  if (!payload.phone_number) throw new Error("Firebase token does not contain a verified phone number");

  return payload as { phone_number: string; sub: string };
}

export async function POST(request: NextRequest) {
  try {
    const { userId, idToken } = await request.json();

    if (!userId || !idToken) {
      return NextResponse.json({ error: "userId and idToken are required" }, { status: 400 });
    }

    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone TEXT`.catch(() => {});
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false`.catch(() => {});
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ`.catch(() => {});

    const existing = await sql`
      SELECT id, role, role_id
      FROM "user"
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = existing[0];
    if (user.role === "superadmin" || user.role_id === 5) {
      return NextResponse.json({ success: true, skipped: true, phone_verified: true });
    }

    const firebaseUser = await verifyFirebasePhoneToken(idToken);
    const phoneLookup = normalizePhoneForLookup(firebaseUser.phone_number);

    const duplicatePhone = await sql`
      SELECT id
      FROM "user"
      WHERE id <> ${userId}
        AND phone IS NOT NULL
        AND phone <> ''
        AND (
          regexp_replace(phone, '[^0-9]', '', 'g') = ${phoneLookup}
          OR regexp_replace(phone, '[^0-9]', '', 'g') = ${`91${phoneLookup}`}
        )
      LIMIT 1
    `;

    if (duplicatePhone.length > 0) {
      return NextResponse.json(
        { error: "This mobile number is already linked to another account." },
        { status: 409 }
      );
    }

    const result = await sql`
      UPDATE "user"
      SET phone = ${firebaseUser.phone_number},
          phone_verified = true,
          phone_verified_at = NOW(),
          "updatedAt" = NOW()
      WHERE id = ${userId}
      RETURNING id, phone, phone_verified, phone_verified_at
    `;

    return NextResponse.json({ success: true, ...result[0] });
  } catch (error: any) {
    console.error("Phone verification error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to verify phone" },
      { status: 400 }
    );
  }
}
