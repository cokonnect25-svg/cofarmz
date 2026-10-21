import { betterAuth } from "better-auth";
import { Pool } from "pg";

const DEFAULT_APP_URL = "https://cofarmz-backend-866114557322.asia-south1.run.app";
const appBaseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_APP_URL;
const isHttpsAuth = appBaseURL.startsWith("https://");
const cleanEnvValue = (value?: string) => value?.trim().replace(/^["']|["']$/g, "");

// In the existing Cloud Run configuration, GOOGLE_CLIENT_ID_MOBILE contains
// the Web OAuth client used by both Better Auth and the Capacitor server flow.
const googleWebClientId = cleanEnvValue(
  process.env.GOOGLE_CLIENT_ID_MOBILE
) || cleanEnvValue(process.env.GOOGLE_CLIENT_ID);

// Both auth contexts use the same database and signing secret. Only the public
// OAuth URL differs; native requests retain the existing Cloud Run base URL.
const database = new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

function createAuth(baseURL: string) {
  return betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET!,
  database,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: googleWebClientId!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
trustedOrigins: Array.from(new Set([
  process.env.FRONTEND_URL,
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_BACKEND_URL,
  DEFAULT_APP_URL,
  "https://cofarmz-backend-866114557322.asia-south1.run.app",
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:8080",
  "https://cofarmz.com",
  "https://www.cofarmz.com",
  "https://cofarmz-backend-866114557322.asia-south1.run.app",
  "capacitor://localhost",
  "com.cofarmz.com://",
  "null",
].filter(Boolean))) as string[],
advanced: {
  crossOriginCookies: true,
  cookiePrefix: "cofarmz",
  defaultCookieAttributes: {
    sameSite: isHttpsAuth ? "none" : "lax",
    secure: isHttpsAuth,
    httpOnly: true,
  }
}
});
}

export const auth = createAuth(appBaseURL);
export const websiteAuth = createAuth("https://cofarmz.com");
