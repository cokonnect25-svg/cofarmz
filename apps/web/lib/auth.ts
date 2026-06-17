import { betterAuth } from "better-auth";
import { Pool } from "pg";

const DEFAULT_APP_URL = "https://cofarmz-backend-866114557322.asia-south1.run.app";
const appBaseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_APP_URL;
const isHttpsAuth = appBaseURL.startsWith("https://");

export const auth = betterAuth({
  baseURL: appBaseURL,
  secret: process.env.BETTER_AUTH_SECRET!,
  database: new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
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
