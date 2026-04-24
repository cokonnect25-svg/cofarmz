'use client';

import { useEffect, useState, useCallback } from 'react';
import OfflineScreen from './OfflineScreen';

export default function OfflineWrapper({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const [ready, setReady] = useState(false); // 🔥 IMPORTANT

  const handleOnline  = useCallback(() => setIsOffline(false), []);
  const handleOffline = useCallback(() => setIsOffline(true), []);

  useEffect(() => {
    const offline = !navigator.onLine;

    setIsOffline(offline);
    setReady(true); // ✅ now we know status

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  const handleRetry = () => {
    fetch('/api/ping', { cache: 'no-store' })
      .then(() => setIsOffline(false))
      .catch(() => setIsOffline(true));
  };

  // 🚫 BLOCK initial render (prevents API calls)
  if (!ready) return null;

  if (isOffline) return <OfflineScreen onRetry={handleRetry} />;

  return <>{children}</>;
}