import { requireActor, fpoError } from '@/lib/fpo-access';
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";
import { ensurePushTokenTable } from "@/app/api/utils/push";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const actor = await requireActor(request);
    const userId = actor.id;
    if(body.userId && body.userId !== userId) return NextResponse.json({error:"Forbidden"},{status:403});
    const { token, platform = "android", deviceId = null } = body;

    if (!userId || !token) {
      return NextResponse.json({ error: "Missing userId or token" }, { status: 400 });
    }

    await ensurePushTokenTable();

    await sql`
      INSERT INTO push_tokens (user_id, token, platform, device_id, enabled)
      VALUES (${userId}, ${token}, ${platform}, ${deviceId}, true)
      ON CONFLICT (token) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          platform = EXCLUDED.platform,
          device_id = EXCLUDED.device_id,
          enabled = true,
          updated_at = NOW(),
          last_seen_at = NOW()
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save push token error:", error);
    return fpoError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireActor(request);
    const userId = actor.id;
    if(body.userId && body.userId !== userId) return NextResponse.json({error:"Forbidden"},{status:403});
    const token = body.token;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    await ensurePushTokenTable();

    if (token) {
      await sql`
        UPDATE push_tokens
        SET enabled = false, updated_at = NOW()
        WHERE user_id = ${userId} AND token = ${token}
      `;
    } else {
      await sql`
        UPDATE push_tokens
        SET enabled = false, updated_at = NOW()
        WHERE user_id = ${userId}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Disable push token error:", error);
    return fpoError(error);
  }
}
