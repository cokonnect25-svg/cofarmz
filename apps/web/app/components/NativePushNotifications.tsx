'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
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
    let pendingToken: string | null = null;
    let saving = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 1000;
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

    const syncToken = async () => {
      if (cancelled || saving || !pendingToken) return;
      if (retryTimer) clearTimeout(retryTimer);
      const token = pendingToken;
      saving = true;
      try {
        await saveToken(token);
        if (pendingToken === token) pendingToken = null;
        retryDelay = 1000;
      } catch (error) {
        console.error('Push token registration failed:', error);
      } finally {
        saving = false;
        if (!cancelled && pendingToken) {
          retryTimer = setTimeout(() => { void syncToken(); }, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 60_000);
        }
      }
    };

    let registering = false;
    const register = async (requestPermission = false) => {
      if (cancelled || registering) return;
      registering = true;
      try {
        let permission = await PushNotifications.checkPermissions();
        if (requestPermission && permission.receive === 'prompt') {
          permission = await PushNotifications.requestPermissions();
        }
        if (permission.receive === 'granted' && !cancelled) {
          await PushNotifications.register();
        }
      } catch (error) {
        console.error('Push registration failed:', error);
      } finally {
        registering = false;
      }
    };

    const onOnline = () => { void syncToken(); void register(); };

    const setupPush = async () => {
      try {
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

        keepListener(await PushNotifications.addListener('registration', ({ value }) => {
          if (cancelled) return;
          pendingToken = value;
          void syncToken();
        }));

        keepListener(await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        }));

        keepListener(await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
          if (cancelled) return;
          const url = event.notification.data?.url || '/notifications';
          router.push(typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/notifications');
        }));

        keepListener(await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive && !cancelled) {
            void syncToken();
            void register();
          }
        }));
        if (cancelled) return;
        window.addEventListener('online', onOnline);
        await register(true);
      } catch (error) {
        console.error('Push setup failed:', error);
      }
    };

    setupPush();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener('online', onOnline);
      listeners.forEach(listener => { void listener.remove(); });
    };
  }, [router, userId]);

  return null;
}
