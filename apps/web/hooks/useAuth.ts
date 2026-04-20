"use client";

import { useSession, authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

const MOBILE_USER_KEY = "cofarmz_mobile_user";
const MOBILE_EXPIRY_KEY = "cofarmz_mobile_expiry";

// ─── helpers ─────────────────────────────────────────

export function storeMobileSession(user: any) {
  if (typeof window === "undefined") return;

  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

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

// ─── useAuth ─────────────────────────────────────────

export function useAuth() {
  const { data: session, isPending: webLoading } = useSession();
  const router = useRouter();

  const isMobile =
    typeof window !== "undefined" && Capacitor.isNativePlatform();

  // ✅ init once from localStorage
  const [mobileUser, setMobileUser] = useState<any>(null);
  const [mobileLoading, setMobileLoading] = useState(isMobile);

  useEffect(() => {
    if (!isMobile) {
      setMobileLoading(false);
      return;
    }

    const stored = getMobileSession();
    setMobileUser(stored);
    setMobileLoading(false);
  }, [isMobile]);

  // ✅ unified state
  const user = isMobile ? mobileUser : session?.user;
  const loading = isMobile ? mobileLoading : webLoading;
  const isAuthenticated = !!user;
  const isReady = !loading;

  // ─── actions ───────────────────────────────────────

  async function signIn(email: string, password: string) {
    const result = await authClient.signIn.email({ email, password });

    if (result.error) {
      throw new Error(result.error.message || "Invalid email or password");
    }

    if (isMobile && result.data?.user) {
      storeMobileSession(result.data.user);
      setMobileUser(result.data.user);
    }

    return result;
  }

  async function signUp(email: string, password: string, name: string) {
    const result = await authClient.signUp.email({ email, password, name });

    if (result.error) {
      throw new Error(result.error.message || "Failed to create account");
    }

    if (isMobile && result.data?.user) {
      storeMobileSession(result.data.user);
      setMobileUser(result.data.user);
    }

    return result;
  }

  async function signOut() {
    clearMobileSession();
    setMobileUser(null);

    await authClient.signOut();
    router.push("/login");
  }

  return {
    user,
    isAuthenticated,
    loading,
    isReady,
    signIn,
    signUp,
    signOut,
    session,
  };
}