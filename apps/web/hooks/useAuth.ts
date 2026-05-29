"use client";

import { useSession, authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

const MOBILE_USER_KEY = "cofarmz_mobile_user";
const MOBILE_EXPIRY_KEY = "cofarmz_mobile_expiry";

export function storeMobileSession(user: any) {
  if (typeof window === "undefined") return;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  localStorage.setItem(MOBILE_USER_KEY, JSON.stringify(user));
  localStorage.setItem(MOBILE_EXPIRY_KEY, expiresAt);
}

export function clearMobileSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(MOBILE_USER_KEY);
  localStorage.removeItem(MOBILE_EXPIRY_KEY);
}

function getMobileSession(): any | null {
  if (typeof window === "undefined") return null;
  try {
    const expiry = localStorage.getItem(MOBILE_EXPIRY_KEY);
    if (expiry && new Date(expiry) < new Date()) {
      clearMobileSession();
      return null;
    }
    const raw = localStorage.getItem(MOBILE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const { data: session, isPending: webLoading } = useSession();
  const router = useRouter();

  const [mobileUser, setMobileUser] = useState<any>(null);
  const [mobileLoading, setMobileLoading] = useState(true); // always true until effect runs

  useEffect(() => {
    // ✅ Safe: Capacitor only called client-side inside useEffect
    if (!Capacitor.isNativePlatform()) {
      setMobileLoading(false);
      return;
    }
    const stored = getMobileSession();
    setMobileUser(stored);
    setMobileLoading(false);
  }, []);

  // ✅ Safe SSR check — evaluated only after hydration in practice
  const isMobile =
    typeof window !== "undefined" &&
    typeof Capacitor !== "undefined" &&
    Capacitor.isNativePlatform();

  const user: any = isMobile ? mobileUser : (session?.user as any);
  const loading = isMobile ? mobileLoading : webLoading;
  const isAuthenticated = !!user;

  async function signIn(email: string, password: string) {
    const result = await authClient.signIn.email({ email, password });
    if (result.error) throw new Error(result.error.message || "Invalid email or password");
    if (isMobile && result.data?.user) {
      storeMobileSession(result.data.user);
      setMobileUser(result.data.user);
    }
    return result;
  }

async function signUp(
  email: string,
  password: string,
  name: string,
  role: 'farmer' | 'buyer' | 'supplier' | 'fpo' | 'superadmin' = 'farmer'
) {
  const result = await authClient.signUp.email({ email, password, name });
  if (result.error) throw new Error(result.error.message || "Failed to create account");

  // Save role to your backend immediately after account creation
  if (result.data?.user?.id) {
    try {
      const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
      await fetch(`${backendUrl}/api/users/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: result.data.user.id,
          email: result.data.user.email,
          role,
          role_confirmed: true,   // skip the role modal on home page
        }),
      });
    } catch (err) {
      console.error('Failed to save role after signup:', err);
    }
  }

  if (isMobile && result.data?.user) {
    storeMobileSession({ ...result.data.user, role });
    setMobileUser({ ...result.data.user, role });
  }
  return result;
}

  async function signOut() {
    clearMobileSession();
    setMobileUser(null);
    await authClient.signOut();
    router.replace("/login");
  }

  return { user, isAuthenticated, loading, signIn, signUp, signOut, session };
}