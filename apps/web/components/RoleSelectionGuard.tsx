"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePathname, useRouter } from "next/navigation";

export function RoleSelectionGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Publicly accessible paths that don't need login
  const publicPaths = [
    '/login', '/signup', '/forgot-password', '/reset-password',
    '/auth-callback', '/terms', '/privacy', '/help', '/about'
  ];
  const isPublicRoute = publicPaths.includes(pathname);

  useEffect(() => {
    // Wait for the auth session to load
    if (loading) return;

    // If already on a login/signup page, don't redirect
    if (isPublicRoute) return;

    // If not logged in, go to login page
    if (!isAuthenticated) {
      router.replace('/login');
    }

    // NOTE: Role selection is now handled directly on the Home Page (/) 
    // using a popup modal. We no longer force-redirect to /select-role here.
  }, [isAuthenticated, loading, isPublicRoute, router]);

  // Show a clean loading state ONLY for non-public routes
  if (loading && !isPublicRoute) {
    return (
      <div className="w-full h-screen bg-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-green-600 border-t-transparent animate-spin mb-4"></div>
      </div>
    );
  }

  return <>{children}</>;
}
