export const getApiUrl = (path: string) => {
  if (typeof window === 'undefined') return path;
  if (path.startsWith('http')) return path;

  const isMobile = (window as any).Capacitor?.isNativePlatform?.();

  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (isMobile) {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    
    if (!backendUrl) {
      throw new Error("NEXT_PUBLIC_BACKEND_URL is not set");
    }

    const baseUrl = backendUrl.endsWith('/')
      ? backendUrl.slice(0, -1)
      : backendUrl;

    return `${baseUrl}${cleanPath}`;
  }

 return `${process.env.NEXT_PUBLIC_BACKEND_URL}${cleanPath}`;
};