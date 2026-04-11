import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const {GET, POST } = toNextJsHandler(auth);

//https://cofarmz.vercel.app/api/auth/[...all]//
