"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_BACKEND_URL || "https://cofarmz.vercel.app",
  fetchOptions: {
    credentials: "include",
  },
});

export const { useSession, signIn } = authClient;
