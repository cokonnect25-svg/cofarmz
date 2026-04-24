'use client';

import { useEffect, useState, useCallback } from 'react';
import OfflineScreen from './OfflineScreen';

export default function OfflineWrapper({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);

  const handleOnline  = useCallback(() => setIsOffline(false), []);
  const handleOffline = useCallback(() => setIsOffline(true),  []);

  useEffect(() => {
    // Set initial state from browser
    setIsOffline(!navigator.onLine);

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  const handleRetry = () => {
    // Re-check live by pinging a tiny endpoint
    fetch('/api/ping', { cache: 'no-store' })
      .then(() => setIsOffline(false))
      .catch(() => setIsOffline(true));
  };

  if (isOffline) return <OfflineScreen onRetry={handleRetry} />;
  return <>{children}</>;
}