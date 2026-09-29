'use client';

import { Capacitor, CapacitorCookies } from '@capacitor/core';
import { getApiUrl } from '@/lib/api';
import { getMobileCredential } from '@/lib/mobile-credential';

// Use the signed mobile login credential: Android getCookies() cannot read
// HttpOnly cookies. Keep cookie fallback for existing installations.
export async function fpoFetch(path: string, options: RequestInit = {}) {
  if (!path.startsWith('/api/')) throw new Error('Expected an API path');
  const url = getApiUrl(path);
  const headers = new Headers(options.headers);
  if (Capacitor.isNativePlatform()) {
    let token = getMobileCredential();
    try {
      if (!token) {
        const cookies = await CapacitorCookies.getCookies({ url: new URL(url, window.location.origin).origin });
        token = cookies['__Secure-cofarmz.session_token'] || cookies['cofarmz.session_token'];
      }
    } catch {
      // Normal cookie authentication remains available if the plugin is unavailable.
    }
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, credentials: 'include', headers });
}
