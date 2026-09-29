'use client';

const KEY = 'cofarmz_mobile_credential';

export function clearMobileCredential() {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY);
}

export function storeMobileCredential(token?: string) {
  clearMobileCredential();
  if (typeof window !== 'undefined' && token) {
    localStorage.setItem(KEY, JSON.stringify({ token, expiresAt: Date.now() + 7 * 86400000 }));
  }
}

export function getMobileCredential(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (typeof value?.token === 'string' && value.expiresAt > Date.now()) return value.token;
    clearMobileCredential();
  } catch { /* Missing or unavailable storage: use cookie authentication. */ }
  return null;
}
