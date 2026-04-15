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
        // Handle pending Google role from signup page
        const pendingRole = localStorage.getItem('pendingGoogleRole');
        if (pendingRole && (pendingRole === 'farmer' || pendingRole === 'buyer')) {
          try {
            await fetch(getApiUrl('/api/users/profile'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id, email: user.email, role: pendingRole }),
            });
            localStorage.removeItem('pendingGoogleRole');
          } catch (e) {
            console.error('Error applying pending role:', e);
          }
        }
        // Redirect to Home — RoleSelectionGuard and Home page modal will handle the rest.
        // This ensures a smoother flow for both new and returning users.
        window.location.replace('/');
      } else if (!loading) {
        // No session found — go to login
        window.location.replace('/login');
      }
    };
    run();
  }, [user, loading, isAuthenticated]);

  // Blank white screen with a subtle centered loader
  return (
    <div className="w-full h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
    </div>
  );
}
