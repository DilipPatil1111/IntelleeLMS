import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth-config";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

export default async function middleware(req: NextRequest) {
  return (auth as unknown as (req: NextRequest) => Promise<Response | undefined>)(req);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
