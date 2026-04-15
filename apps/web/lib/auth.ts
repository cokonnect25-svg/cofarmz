import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL!,
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
trustedOrigins: [
  "http://localhost",
  "http://localhost:3000",
  "https://cofarmz.com",
  "https://cofarms.netlify.app",
  "capacitor://localhost",
  "com.cofarmz.app://"
],
advanced: {
  crossOriginCookies: true,
  cookiePrefix: "cofarmz",
  defaultCookieAttributes: {
    sameSite: "none",   // ✅ FIXED
    secure: true,       // ✅ REQUIRED for SameSite=None
    httpOnly: true,
  }
}
});
