import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth-config";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

/** Next.js 16+ — use `proxy` instead of deprecated `middleware` export. */
export async function proxy(req: NextRequest) {
  return (auth as unknown as (req: NextRequest) => Promise<Response | undefined>)(req);
}

export const config = {
  matcher: [
    /*
     * Only run auth proxy on routes that need portal / login enforcement.
     * Do NOT match `/api` (especially `/api/auth/session`): SessionProvider expects JSON.
     */
    "/student/:path*",
    "/teacher/:path*",
    "/principal/:path*",
    "/change-password",
  ],
};
