import { GoogleAuth } from "google-auth-library";
import sql from "@/app/api/utils/sql";

type PushPayload = {
  title: string;
  body: string;
  image?: string | null;
  url?: string;
  tag?: string;
  data?: Record<string, string | number | boolean | null | undefined>;
};

export type PushDeliveryResult = {
  attempted: number;
  succeeded: number;
  failed: number;
};

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export async function ensurePushTokenTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS push_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL DEFAULT 'android',
      device_id TEXT,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_push_tokens_user_enabled
    ON push_tokens(user_id, enabled)
  `;
}

function getFirebaseProjectId() {
  const credentials = getServiceAccountCredentials();

  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    credentials?.project_id ||
    ""
  );
}

function getServiceAccountCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return undefined;

  try {
    return JSON.parse(raw);
  } catch {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(decoded);
  }
}

async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const credentials = getServiceAccountCredentials();
  const auth = new GoogleAuth({
    credentials,
    scopes: [FCM_SCOPE],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  if (!token) {
    throw new Error("Unable to get Firebase access token");
  }

  cachedAccessToken = {
    token,
    expiresAt: Date.now() + 50 * 60 * 1000,
  };

  return token;
}

function toDataPayload(payload: PushPayload) {
  const data: Record<string, string> = {
    url: payload.url || "/notifications",
    tag: payload.tag || "cofarmz",
  };

  Object.entries(payload.data || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      data[key] = String(value);
    }
  });

  return data;
}

async function sendToToken(token: string, payload: PushPayload) {
  const projectId = getFirebaseProjectId();
  if (!projectId) {
    console.warn("Skipping push notification: FIREBASE_PROJECT_ID is not configured");
    return { ok: false, status: 0 };
  }

  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: payload.title,
            body: payload.body,
            ...(payload.image ? { image: payload.image } : {}),
          },
          data: toDataPayload(payload),
          android: {
            priority: "high",
            notification: {
              channel_id: "default",
              click_action: "OPEN_APP",
              sound: "default",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
              },
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("FCM send failed:", response.status, text);
  }

  return { ok: response.ok, status: response.status };
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!userId) return;

  try {
    await ensurePushTokenTable();
    const rows = await sql`
      SELECT token
      FROM push_tokens
      WHERE user_id = ${userId}
        AND enabled = true
      ORDER BY last_seen_at DESC
      LIMIT 5
    `;

    await Promise.all(
      rows.map(async (row: any) => {
        const result = await sendToToken(row.token, payload);
        if (result.status === 404 || result.status === 400) {
          await sql`
            UPDATE push_tokens
            SET enabled = false, updated_at = NOW()
            WHERE token = ${row.token}
          `.catch(() => {});
        }
      })
    );
  } catch (error) {
    console.error("Push notification error:", error);
  }
}

export async function sendPushToFollowers(creatorId: string, payload: PushPayload) {
  if (!creatorId) return;
  try {
    const followers = await sql`
      SELECT DISTINCT user_id FROM follows
      WHERE following_id = ${creatorId} AND status = 'accepted' AND user_id != ${creatorId}
    `;
    await Promise.all(
      followers.map((follower: any) =>
        sendPushToUser(String(follower.user_id), payload)
      )
    );
  } catch (error) {
    console.error("Follower push notification error:", error);
  }
}

export async function sendPushToAllUsers(payload: PushPayload) {
  try {
    await ensurePushTokenTable();
    const rows = await sql`
      SELECT DISTINCT ON (token) token
      FROM push_tokens
      WHERE enabled = true
      ORDER BY token, last_seen_at DESC
      LIMIT 500
    `;

    const results = await Promise.allSettled(
      rows.map((row: any) => sendToToken(row.token, payload))
    );
    const succeeded = results.filter(
      (result) => result.status === "fulfilled" && result.value.ok
    ).length;

    return {
      attempted: rows.length,
      succeeded,
      failed: rows.length - succeeded,
    } satisfies PushDeliveryResult;
  } catch (error) {
    console.error("Broadcast push notification error:", error);
    return {
      attempted: 0,
      succeeded: 0,
      failed: 1,
    } satisfies PushDeliveryResult;
  }
}
