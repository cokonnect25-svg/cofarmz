"use client";

import { createAuthClient } from "better-auth/react";

const DEFAULT_BACKEND_URL = "https://cofarmz-backend-866114557322.asia-south1.run.app";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL,
  fetchOptions: {
    credentials: "include",
  },
});

export const { useSession, signIn } = authClient;
