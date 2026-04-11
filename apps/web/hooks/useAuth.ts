"use client";

import { useSession, authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function useAuth() {
  const { data: session, isPending: loading } = useSession();
  const router = useRouter();

  const user = session?.user as any;
  const isAuthenticated = !!user;

  async function signIn(email: string, password: string) {
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      throw new Error(result.error.message || "Invalid email or password");
    }
    return result;
  }

  async function signUp(email: string, password: string, name: string) {
    const result = await authClient.signUp.email({ email, password, name });
    if (result.error) {
      throw new Error(result.error.message || "Failed to create account");
    }
    return result;
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
  }

  return { user, isAuthenticated, loading, signIn, signUp, signOut, session };
}
