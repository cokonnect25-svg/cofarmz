'use client';

import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { getApiUrl } from "@/lib/api";

type UpdateConfig = {
  minimumBuild: number;
  latestBuild?: number;
  versionName?: string;
  mandatory?: boolean;
  playStoreUrl: string;
  title?: string;
  message?: string;
};

const FALLBACK_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.cofarmz.com";

function parseBuild(build: string | undefined) {
  const parsed = Number(build);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function MandatoryUpdateGate() {
  const [requiredUpdate, setRequiredUpdate] = useState<UpdateConfig | null>(null);
  const [openingStore, setOpeningStore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkForMandatoryUpdate() {
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

      try {
        const [appInfo, response] = await Promise.all([
          App.getInfo(),
          fetch(getApiUrl("/api/app-update"), { cache: "no-store" }),
        ]);

        if (!response.ok) return;

        const data = await response.json();
        const androidConfig = data?.android as UpdateConfig | undefined;
        const installedBuild = parseBuild(appInfo.build);

        if (
          androidConfig?.mandatory &&
          Number.isFinite(androidConfig.minimumBuild) &&
          installedBuild > 0 &&
          installedBuild < androidConfig.minimumBuild
        ) {
          if (!cancelled) setRequiredUpdate(androidConfig);
        }
      } catch {
        // Do not block users if the update service is temporarily unavailable.
      }
    }

    checkForMandatoryUpdate();
    const interval = window.setInterval(checkForMandatoryUpdate, 10 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  if (!requiredUpdate) return null;

  const playStoreUrl = requiredUpdate.playStoreUrl || FALLBACK_PLAY_STORE_URL;

  async function openPlayStore() {
    setOpeningStore(true);
    try {
      await Browser.open({ url: playStoreUrl, presentationStyle: "fullscreen" });
    } finally {
      setOpeningStore(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] bg-white flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-700">
          <i className="ph-bold ph-arrow-circle-up text-4xl" aria-hidden="true"></i>
        </div>

        <h1 className="text-2xl font-black text-gray-950">
          {requiredUpdate.title || "Update required"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          {requiredUpdate.message ||
            "Please update CoFarmz to continue using the app features."}
        </p>

        <button
          type="button"
          onClick={openPlayStore}
          disabled={openingStore}
          className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-5 text-sm font-bold text-white shadow-sm transition active:bg-green-700 disabled:opacity-70"
        >
          <i className="ph-bold ph-google-play-logo text-lg" aria-hidden="true"></i>
          {openingStore ? "Opening Play Store..." : "Update from Play Store"}
        </button>
      </div>
    </div>
  );
}
