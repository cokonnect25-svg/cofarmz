'use client';

const KEY = 'cofarmz_fpo_profile_cache_v1';
const MAX_AGE = 7 * 86400000;
export type CachedFpo = { district?: string; state?: string; assignment_status?: string; [key: string]: unknown } | null;
export function clearFpoCache() {
  try { localStorage.removeItem(KEY); } catch { /* Storage may be unavailable. */ }
}
export function readFpoCache(userId: string): { mine: CachedFpo; savedAt: number } | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (value?.userId !== userId || typeof value.savedAt !== 'number' || Date.now() - value.savedAt > MAX_AGE || !('mine' in value)) return null;
    return value;
  } catch { return null; }
}
export function writeFpoCache(userId: string, mine: CachedFpo) {
  try { localStorage.setItem(KEY, JSON.stringify({ userId, mine, savedAt: Date.now() })); }
  catch { /* A failed cache write must not hide fresh server data. */ }
}
