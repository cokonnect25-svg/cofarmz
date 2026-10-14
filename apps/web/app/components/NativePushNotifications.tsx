'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { fpoFetch } from '@/lib/fpo-fetch';

type Props = {
  userId?: string | null;
};

export default function NativePushNotifications({ userId }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!userId || !Capacitor.isNativePlatform()) return;

    let cancelled = false;
    const listeners: PluginListenerHandle[] = [];
    const keepListener = (listener: PluginListenerHandle) => {
      if (cancelled) void listener.remove();
      else listeners.push(listener);
    };

    const saveToken = async (token: string) => {
      const response = await fpoFetch('/api/push-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          token,
          platform: Capacitor.getPlatform(),
        }),
      });
      if (!response.ok) throw new Error(`Push token registration failed (${response.status})`);
    };

    const setupPush = async () => {
      try {
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== 'granted' || cancelled) return;

        if (Capacitor.getPlatform() === 'android') {
          await PushNotifications.createChannel({
            id: 'default',
            name: 'CoFarmz Notifications',
            description: 'Booking, message, follow, and announcement alerts',
            importance: 5,
            visibility: 1,
            sound: 'default',
          });
        }

        keepListener(await PushNotifications.addListener('registration', async ({ value }) => {
          if (!cancelled) {
            try {
              await saveToken(value);
            } catch (error) {
              console.error('Push token registration failed:', error);
            }
          }
        }));

        keepListener(await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        }));

        keepListener(await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
          if (cancelled) return;
          const url = event.notification.data?.url || '/notifications';
          router.push(typeof url === 'string' && url.startsWith('/') ? url : '/notifications');
        }));

        if (!cancelled) await PushNotifications.register();
      } catch (error) {
        console.error('Push setup failed:', error);
      }
    };

    setupPush();

    return () => {
      cancelled = true;
      listeners.forEach(listener => { void listener.remove(); });
    };
  }, [router, userId]);

  return null;
}
