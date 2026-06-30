export const COFARMZ_WEB_ORIGIN = 'https://cofarmz.com';
export const COFARMZ_APP_PACKAGE = 'com.cofarmz.com';
export const COFARMZ_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${COFARMZ_APP_PACKAGE}`;

const ALLOWED_IN_APP_PATHS = new Set([
  '/farmer-profile',
  '/reels',
  '/machinery-details',
]);

export function buildOpenUrl(path: string, params: Record<string, string | number | null | undefined> = {}) {
  const url = new URL('/open', COFARMZ_WEB_ORIGIN);
  url.searchParams.set('path', path);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value).trim()) {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

export function buildAndroidIntentUrl(pathWithQuery: string) {
  const target = new URL(pathWithQuery, COFARMZ_WEB_ORIGIN);
  const intentPath = `${target.host}${target.pathname}${target.search}`;
  return `intent://${intentPath}#Intent;scheme=https;package=${COFARMZ_APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(COFARMZ_PLAY_STORE_URL)};end`;
}

export function getInAppPathFromSharedUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);

    if (url.protocol === 'cofarmz:') {
      const path = url.pathname.startsWith('/') ? url.pathname : `/${url.hostname}${url.pathname}`;
      return ALLOWED_IN_APP_PATHS.has(path) ? `${path}${url.search}` : null;
    }

    if (!['cofarmz.com', 'www.cofarmz.com'].includes(url.hostname)) return null;

    if (url.pathname === '/open') {
      const path = url.searchParams.get('path') || '';
      if (!ALLOWED_IN_APP_PATHS.has(path)) return null;

      const params = new URLSearchParams(url.search);
      params.delete('path');
      const query = params.toString();
      return query ? `${path}?${query}` : path;
    }

    if (ALLOWED_IN_APP_PATHS.has(url.pathname)) {
      return `${url.pathname}${url.search}`;
    }
  } catch {}

  return null;
}
