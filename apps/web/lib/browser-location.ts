export async function getBrowserPosition(): Promise<GeolocationPosition> {
  if (typeof window === 'undefined' || !window.isSecureContext) {
    throw new Error('Open CoFarmz over HTTPS to detect your location. You can also choose it on the map.');
  }
  if (!navigator.geolocation) {
    throw new Error('This browser cannot detect your location. Please choose it on the map.');
  }
  const request = (enableHighAccuracy: boolean, timeout: number) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy,
        timeout,
        maximumAge: 60000,
      });
    });
  try {
    return await request(false, 30000);
  } catch (error) {
    const code = (error as GeolocationPositionError)?.code;
    // Retrying cannot override denied browser/OS permissions.
    if (code !== 2 && code !== 3) throw error;
    return request(true, 15000);
  }
}

export function getLocationErrorMessage(error: unknown): string {
  const code = (error as GeolocationPositionError)?.code;
  if (code === 1) return 'Location access is blocked. Allow location for this site in your browser and enable location services in your laptop settings, or choose your farm on the map.';
  if (code === 2) return 'Your device could not determine its location. Check location services and your connection, or choose your farm on the map.';
  if (code === 3) return 'Location detection timed out. Please retry or choose your farm on the map.';
  return error instanceof Error ? error.message : 'Unable to detect your location. Please retry or choose your farm on the map.';
}
