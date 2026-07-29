/* public/sw.js — Service Worker for Web Push Notifications */

const CACHE_NAME = 'cofarmz-push-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Handle Push Notifications (app is closed/background) ──
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title || 'CoFarmz Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/badge-72x72.png',
    image: data.image || undefined,
    tag: data.tag || data.id || 'default',
    requireInteraction: data.requireInteraction ?? false,
    data: {
      url: data.url || '/notifications',
      ...data,
    },
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Handle Notification Click ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || '/notifications';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it and navigate
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({ type: 'NAVIGATE', url });
            return;
          }
        }
        // If app is closed, open it
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// ── Handle notification action buttons ──
self.addEventListener('notificationclick', (event) => {
  if (event.action === 'open') {
    const url = event.notification.data?.url || '/notifications';
    event.waitUntil(self.clients.openWindow(url));
  }
  if (event.action === 'dismiss') {
    event.notification.close();
  }
});