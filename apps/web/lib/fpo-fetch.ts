'use client';

import { Capacitor, CapacitorCookies } from '@capacitor/core';
import { getApiUrl } from '@/lib/api';

// Capacitor's native cookie jar is not always attached to WebView fetches.
// Forward the existing signed credential only to our own API.
export async function fpoFetch(path: string, options: RequestInit = {}) {
  if (!path.startsWith('/api/')) throw new Error('Expected an API path');
  const url = getApiUrl(path);
  const headers = new Headers(options.headers);
  if (Capacitor.isNativePlatform()) {
    try {
      const cookies = await CapacitorCookies.getCookies({ url: new URL(url, window.location.origin).origin });
      const token = cookies['__Secure-cofarmz.session_token'] || cookies['cofarmz.session_token'];
      if (token) headers.set('Authorization', `Bearer ${token}`);
    } catch {
      // Normal cookie authentication remains available if the plugin is unavailable.
    }
  }
  return fetch(url, { ...options, credentials: 'include', headers });
}
