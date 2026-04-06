import type { NextAuthConfig } from "next-auth";
import { hasPrincipalPortalAccess, hasStudentPortalAccess, hasTeacherPortalAccess } from "@/lib/portal-access";
import type { Session } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as unknown as Record<string, unknown>).role;
        token.id = user.id;
        token.mustChangePassword = (user as unknown as Record<string, unknown>).mustChangePassword as boolean;
        const gp = (user as unknown as Record<string, unknown>).grantedPortals;
        token.grantedPortals = Array.isArray(gp) ? gp : [];
      }
      // Keep JWT edge-safe: do not import Prisma here (middleware bundles this file).
      // Client can call session.update({ mustChangePassword: false }) if we add a flow without signOut.
      if (trigger === "update" && session && typeof session === "object") {
        const s = session as Record<string, unknown>;
        if (typeof s.mustChangePassword === "boolean") {
          token.mustChangePassword = s.mustChangePassword;
        }
        if (Array.isArray(s.grantedPortals)) {
          token.grantedPortals = s.grantedPortals as ("STUDENT" | "TEACHER" | "PRINCIPAL")[];
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as Record<string, unknown>).id = token.id;
        (session.user as unknown as Record<string, unknown>).role = token.role;
        (session.user as unknown as Record<string, unknown>).mustChangePassword = token.mustChangePassword;
        (session.user as unknown as Record<string, unknown>).grantedPortals = Array.isArray(token.grantedPortals)
          ? token.grantedPortals
          : [];
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/assess"];
      const isPublic = publicRoutes.some(
        (route) => pathname === route || pathname.startsWith(route + "/")
      );
      const isAuthApi = pathname.startsWith("/api/auth");
      const isChangePassword = pathname === "/change-password";

      if (isPublic || isAuthApi) return true;
      if (!isLoggedIn) return false;

      const mustChange = (auth?.user as unknown as Record<string, unknown>)?.mustChangePassword as boolean | undefined;
      if (mustChange) {
        if (isChangePassword) return true;
        if (pathname.startsWith("/api/user/change-password")) return true;
        if (pathname.startsWith("/api/auth")) return true;
        return Response.redirect(new URL("/change-password", nextUrl));
      }

      const session = {
        user: auth?.user,
      } as Session;

      if (pathname.startsWith("/student") && !hasStudentPortalAccess(session)) return false;
      if (pathname.startsWith("/teacher") && !hasTeacherPortalAccess(session)) return false;
      if (pathname.startsWith("/principal") && !hasPrincipalPortalAccess(session)) return false;

      return true;
    },
  },
};
