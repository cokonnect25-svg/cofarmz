export const getApiUrl = (path: string) => {
  if (typeof window === 'undefined') return path;
  if (path.startsWith('http')) return path;

  const isMobile = (window as any).Capacitor?.isNativePlatform?.();

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://cofarmz-backend-866114557322.asia-south1.run.app";

  if (isMobile) {
    const baseUrl = backendUrl.endsWith('/')
      ? backendUrl.slice(0, -1)
      : backendUrl;

    return `${baseUrl}${cleanPath}`;
  }

  const baseUrl = backendUrl.endsWith('/')
    ? backendUrl.slice(0, -1)
    : backendUrl;

  return `${baseUrl}${cleanPath}`;
};
