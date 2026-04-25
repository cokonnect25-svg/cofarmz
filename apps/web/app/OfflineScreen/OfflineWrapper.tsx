'use client';

import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import OfflineScreen from './OfflineScreen';

export default function OfflineWrapper({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let networkListener: any = null;

    const init = async () => {
      if (Capacitor.isNativePlatform()) {
        // ✅ Native: use Capacitor Network plugin (works before WebView loads)
        const status = await Network.getStatus();
        setIsOffline(!status.connected);
        setReady(true);

        networkListener = await Network.addListener('networkStatusChange', (status) => {
          setIsOffline(!status.connected);
        });
      } else {
        // ✅ Web: use browser events
        setIsOffline(!navigator.onLine);
        setReady(true);

        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };
      }
    };

    init();

    return () => {
      if (networkListener) networkListener.remove();
    };
  }, []);

  const handleRetry = async () => {
    if (Capacitor.isNativePlatform()) {
      const status = await Network.getStatus();
      setIsOffline(!status.connected);
    } else {
      try {
        await fetch('/api/ping', { cache: 'no-store' });
        setIsOffline(false);
      } catch {
        setIsOffline(true);
      }
    }
  };

  if (!ready) return null;
  if (isOffline) return <OfflineScreen onRetry={handleRetry} />;
  return <>{children}</>;
}