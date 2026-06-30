'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { buildAndroidIntentUrl, COFARMZ_PLAY_STORE_URL } from '@/lib/deep-link';

function OpenInAppContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const path = searchParams.get('path') || '/';
    const params = new URLSearchParams(searchParams.toString());
    params.delete('path');
    const query = params.toString();
    const targetPath = query ? `${path}?${query}` : path;
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isAndroid) {
      window.location.href = buildAndroidIntentUrl(targetPath);
      const fallback = window.setTimeout(() => {
        window.location.href = COFARMZ_PLAY_STORE_URL;
      }, 1400);
      return () => window.clearTimeout(fallback);
    }

    window.location.href = COFARMZ_PLAY_STORE_URL;
  }, [searchParams]);

  return (
    <main className="min-h-[100dvh] bg-white flex items-center justify-center px-6 text-center">
      <div>
        <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-green-600 border-t-transparent animate-spin" />
        <h1 className="text-xl font-black text-gray-950">Opening CoFarmz</h1>
        <p className="mt-2 text-sm font-medium text-gray-500">If the app is not installed, you will be taken to Play Store.</p>
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
