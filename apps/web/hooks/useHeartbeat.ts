'use client';

import { useEffect, useRef } from 'react';
import { getApiUrl } from '@/lib/api';

export function useHeartbeat(userId: string | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const sendHeartbeat = async () => {
      try {
        await fetch(getApiUrl('/api/users/heartbeat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
      } catch (e) {}
    };

    // Send immediately on mount
    sendHeartbeat();

    // Then every 30 seconds
    intervalRef.current = setInterval(sendHeartbeat, 30000);

    // Also send on beforeunload
    const handleBeforeUnload = () => {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          getApiUrl('/api/users/heartbeat'),
          JSON.stringify({ userId })
        );
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId]);
}