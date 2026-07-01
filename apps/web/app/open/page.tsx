'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { buildAndroidIntentUrl, COFARMZ_PLAY_STORE_URL } from '@/lib/deep-link';

function OpenInAppContent() {
  const searchParams = useSearchParams();
  const path = searchParams.get('path') || '/';
  const params = new URLSearchParams(searchParams.toString());
  params.delete('path');
  const query = params.toString();
  const targetPath = query ? `${path}?${query}` : path;
  const androidIntentUrl = buildAndroidIntentUrl(targetPath);

  useEffect(() => {
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isAndroid) {
      window.location.href = androidIntentUrl;
      const fallback = window.setTimeout(() => {
        window.location.href = COFARMZ_PLAY_STORE_URL;
      }, 2500);
      return () => window.clearTimeout(fallback);
    }
  }, [androidIntentUrl]);

  return (
    <main className="min-h-[100dvh] bg-white flex items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-green-600 border-t-transparent animate-spin" />
        <h1 className="text-xl font-black text-gray-950">Opening CoFarmz</h1>
        <p className="mt-2 text-sm font-medium text-gray-500">If the app is installed, this link opens there. Otherwise, install CoFarmz from Play Store.</p>
        <div className="mt-5 flex flex-col gap-3">
          <a href={androidIntentUrl} className="rounded-xl bg-green-700 px-4 py-3 text-sm font-black text-white shadow-sm">
            Open CoFarmz app
          </a>
          <a href={COFARMZ_PLAY_STORE_URL} className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-black text-gray-800">
            Install CoFarmz
          </a>
        </div>
      </div>
    </main>
  );
}

export default function OpenInAppPage() {
  return (
    <Suspense fallback={<OpenInAppLoading />}>
      <OpenInAppContent />
    </Suspense>
  );
}

function OpenInAppLoading() {
  return (
    <main className="min-h-[100dvh] bg-white flex items-center justify-center px-6 text-center">
      <div>
        <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-green-600 border-t-transparent animate-spin" />
        <h1 className="text-xl font-black text-gray-950">Opening CoFarmz</h1>
      </div>
    </main>
  );
}
