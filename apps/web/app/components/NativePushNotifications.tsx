'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getApiUrl } from '@/lib/api';

type Props = {
  userId?: string | null;
};

export default function NativePushNotifications({ userId }: Props) {
  const router = useRouter();
  const registeredUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !Capacitor.isNativePlatform()) return;
    if (registeredUserRef.current === userId) return;

    let cancelled = false;

    const saveToken = async (token: string) => {
      await fetch(getApiUrl('/api/push-tokens'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          userId,
          token,
          platform: Capacitor.getPlatform(),
        }),
      }).catch(() => {});
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
          }).catch(() => {});
        }

        await PushNotifications.removeAllListeners();

        await PushNotifications.addListener('registration', async ({ value }) => {
          if (!cancelled) {
            await saveToken(value);
            registeredUserRef.current = userId;
          }
        });

        await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
          const url = event.notification.data?.url || '/notifications';
          router.push(url);
        });

        await PushNotifications.register();
      } catch (error) {
        console.error('Push setup failed:', error);
      }
    };

    setupPush();

    return () => {
      cancelled = true;
    };
  }, [router, userId]);

  return null;
}
