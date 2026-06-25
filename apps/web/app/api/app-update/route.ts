export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";

const DEFAULT_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.cofarmz.com";

function toNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET() {
  const minimumAndroidBuild = toNumber(process.env.MIN_SUPPORTED_ANDROID_VERSION_CODE, 6);
  const latestAndroidBuild = toNumber(process.env.LATEST_ANDROID_VERSION_CODE, minimumAndroidBuild);

  return NextResponse.json(
    {
      android: {
        minimumBuild: minimumAndroidBuild,
        latestBuild: latestAndroidBuild,
        versionName: process.env.LATEST_ANDROID_VERSION_NAME || "1.6",
        mandatory: process.env.FORCE_ANDROID_UPDATE === "true",
        playStoreUrl: process.env.ANDROID_PLAY_STORE_URL || DEFAULT_PLAY_STORE_URL,
        title: process.env.ANDROID_UPDATE_TITLE || "Update required",
        message:
          process.env.ANDROID_UPDATE_MESSAGE ||
          "Please update CoFarmz to continue using the app features.",
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
