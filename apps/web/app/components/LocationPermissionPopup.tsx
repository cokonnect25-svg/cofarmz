'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePathname } from 'next/navigation';
import { getApiUrl } from '@/lib/api';
import { Capacitor } from '@capacitor/core';

export default function LocationPermissionPopup() {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const hideNav = ['/login', '/signup', '/forgot-password', '/reset-password', '/select-role', '/auth-callback'].includes(pathname);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || hideNav) return;

    // Always check DB — show popup if no lat/lon saved, regardless of localStorage
    const checkAndShow = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/farmers/profile?farmerId=${user.id}`), {
          headers: { 'x-user-id': user.id }
        });
        if (res.ok) {
          const data = await res.json();
          const hasLocation = data.latitude && data.longitude &&
            parseFloat(data.latitude) !== 0 && parseFloat(data.longitude) !== 0;
          if (hasLocation) return; // already has real location — don't show
        }
      } catch {}
      // No valid location in DB — show popup after 1.5s
      setTimeout(() => setShow(true), 1500);
    };

    checkAndShow();
  }, [isAuthenticated, user?.id, hideNav]);

  const allowLocation = async () => {
    setSaving(true);
    setError('');
    try {
      let latitude: number, longitude: number;
      if (Capacitor.isNativePlatform()) {
        const { Geolocation } = await import('@capacitor/geolocation');
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } else {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
        );
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      }

      // Reverse geocode
      let locationText = '';
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
          { headers: { 'User-Agent': 'CoFarmz/1.0' } }
        );
        if (res.ok) {
          const data = await res.json();
          const a = data.address || {};
          locationText = [a.suburb || a.village || a.town, a.city || a.county, a.state].filter(Boolean).join(', ');
        }
      } catch {}
      if (!locationText) {
        locationText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      }

      // Save to user profile
      const saveRes = await fetch(getApiUrl('/api/users/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user!.id },
        body: JSON.stringify({ userId: user!.id, latitude, longitude, location: locationText }),
      });
      if (!saveRes.ok) throw new Error('Unable to save location');

      // Notify other components that location was updated
      window.dispatchEvent(new CustomEvent('userLocationUpdated', { detail: { latitude, longitude, location: locationText } }));
      setDone(true);
      setTimeout(() => setShow(false), 1500);
    } catch {
      setError('Location is required to continue. Please allow location access and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-t-3xl w-full max-w-lg px-6 pb-10 pt-6 shadow-2xl">
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-6"></div>
        {done ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="ph-bold ph-check text-emerald-600 text-2xl"></i>
            </div>
            <p className="font-bold text-gray-900">Location saved!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                <i className="ph-bold ph-map-pin text-emerald-600 text-3xl"></i>
              </div>
            </div>
            <h2 className="text-xl font-black text-gray-900 text-center mb-2">Choose Your Farm Location</h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              Location is required so nearby farmers, buyers and equipment show correct distances from you.
            </p>
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-700">
                {error}
              </div>
            )}
            <button
              onClick={allowLocation}
              disabled={saving}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm mb-3 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Detecting your location...</>
              ) : (
                <><i className="ph-bold ph-map-pin"></i> Detect My Farm Location</>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
