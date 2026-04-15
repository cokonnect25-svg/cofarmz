"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePathname, useRouter } from "next/navigation";

export function RoleSelectionGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Normalize pathname to handle trailing slashes from static export
  const normalizedPathname = pathname?.replace(/\/$/, '') || '/';
  
  // Publicly accessible paths that don't need login
  const publicPaths = [
    '/login', '/signup', '/forgot-password', '/reset-password',
    '/auth-callback', '/terms', '/privacy', '/help', '/about'
  ];
  const isPublicRoute = publicPaths.includes(normalizedPathname);

  useEffect(() => {
    // Wait for mount and auth session to load
    if (!mounted || loading) return;

    // If already on a login/signup page, don't redirect
    if (isPublicRoute) return;

    // If not logged in, go to login page
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [mounted, isAuthenticated, loading, isPublicRoute, router]);

  // Prevent hydration mismatch: always render null or children initially
  // On the client, after mount, we can show the spinner if needed
  if (!mounted) {
    return <>{children}</>;
  }

  // Show a clean loading state ONLY for non-public routes after mount
  if (loading && !isPublicRoute) {
    return (
      <div className="w-full h-screen bg-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-green-600 border-t-transparent animate-spin mb-4"></div>
      </div>
    );
  }

  return <>{children}</>;
}
