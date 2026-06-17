'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';

export default function AuthCallbackPage() {
  const { user, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    const run = async () => {
      // Just wait for the session to load
      if (loading) return;

      if (isAuthenticated && user?.id) {
        // Clean up any leftover pendingGoogleRole from older flow
        localStorage.removeItem('pendingGoogleRole');

        const loginKey = `google_login_logged_${user.id}`;
        if (!sessionStorage.getItem(loginKey)) {
          sessionStorage.setItem(loginKey, '1');
          await fetch(getApiUrl('/api/analytics'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventType: 'login',
              userId: user.id,
              userName: user.name || null,
              userEmail: user.email || null,
              pagePath: '/auth-callback',
              metadata: { method: 'google_web' },
            }),
          }).catch(() => {});
        }

        // Check if this user has already selected a role
        try {
          const res = await fetch(getApiUrl(`/api/users/profile?userId=${user.id}`));
          if (res.ok) {
            const profile = await res.json();
            if (profile.role_confirmed === true) {
              // Returning user — go home
              window.location.replace('/');
              return;
            }
          }
        } catch (e) {
          console.error('Error checking profile:', e);
        }

        // New user — show full Terms & Conditions + role selection
        window.location.replace('/select-role');
      } else if (!loading) {
        // No session found — go to login
        window.location.replace('/login');
      }
    };
    run();
  }, [user, loading, isAuthenticated]);

  // Blank white screen with a subtle centered loader
  return (
    <div className="w-full min-h-[100dvh] bg-white flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
    </div>
  );
}
