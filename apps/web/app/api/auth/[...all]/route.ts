// export const dynamic = 'force-dynamic';
// import { auth } from "@/lib/auth";
// import { toNextJsHandler } from "better-auth/next-js";

// export const {GET, POST } = toNextJsHandler(auth);

//https://cofarmz.vercel.app/api/auth/[...all]//


import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

const ALLOWED_ORIGIN = process.env.FRONTEND_URL || "https://cofarmz-backend-866114557322.asia-south1.run.app";

function addCors(res: Response) {
  res.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

export async function GET(req: Request) {
  const res = await handler.GET(req);
  return addCors(res);
}

export async function POST(req: Request) {
  const res = await handler.POST(req);
  return addCors(res);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}