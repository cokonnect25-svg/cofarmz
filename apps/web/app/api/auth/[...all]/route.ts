// // export const dynamic = 'force-dynamic';
// // import { auth } from "@/lib/auth";
// // import { toNextJsHandler } from "better-auth/next-js";

// // export const {GET, POST } = toNextJsHandler(auth);

// //https://cofarmz.vercel.app/api/auth/[...all]//


// import { auth } from "@/lib/auth";
// import { toNextJsHandler } from "better-auth/next-js";

// const handler = toNextJsHandler(auth);

// const ALLOWED_ORIGIN = process.env.FRONTEND_URL || "https://cofarmz-backend-866114557322.asia-south1.run.app";

// function addCors(res: Response) {
//   res.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
//   res.headers.set("Access-Control-Allow-Credentials", "true");
//   res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
//   res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
//   return res;
// }

// export async function GET(req: Request) {
//   const res = await handler.GET(req);
//   return addCors(res);
// }

// export async function POST(req: Request) {
//   const res = await handler.POST(req);
//   return addCors(res);
// }

// export async function OPTIONS() {
//   return new Response(null, {
//     status: 200,
//     headers: {
//       "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
//       "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
//       "Access-Control-Allow-Headers": "Content-Type, Authorization",
//       "Access-Control-Allow-Credentials": "true",
//     },
//   });
// }


import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

const DEFAULT_APP_ORIGIN = "https://cofarmz-backend-866114557322.asia-south1.run.app";
const ALLOWED_ORIGINS = Array.from(new Set([
  process.env.FRONTEND_URL,
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_BACKEND_URL,
  DEFAULT_APP_ORIGIN,
  "https://cofarmz-backend-866114557322.asia-south1.run.app",
  "https://cofarmz.com",
  "https://cofarmz-backend-866114557322.asia-south1.run.app",
  "http://localhost:3000",
  "http://localhost",
  "http://localhost:8080",
  "capacitor://localhost",
  "com.cofarmz.com://",
  "null",
].filter(Boolean))) as string[];

function getAllowedOrigin(req: Request) {
  const origin = req.headers.get("origin");

  if (!origin) return process.env.FRONTEND_URL || process.env.BETTER_AUTH_URL || DEFAULT_APP_ORIGIN;
  if (origin === "null") return "null";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;

  return process.env.FRONTEND_URL || process.env.BETTER_AUTH_URL || DEFAULT_APP_ORIGIN;
}

function addCors(res: Response, req: Request) {
  const allowed = getAllowedOrigin(req);

  res.headers.set("Access-Control-Allow-Origin", allowed);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

export async function GET(req: Request) {
  const res = await handler.GET(req);
  return addCors(res, req);
}

export async function POST(req: Request) {
  const res = await handler.POST(req);
  return addCors(res, req);
}

export async function OPTIONS(req: Request) {
  const allowed = getAllowedOrigin(req);

  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": allowed,
      "Vary": "Origin",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}
