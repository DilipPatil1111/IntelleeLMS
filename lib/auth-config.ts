import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = (user as unknown as Record<string, unknown>).role;
        token.id = user.id;
        token.mustChangePassword = (user as unknown as Record<string, unknown>).mustChangePassword as boolean;
      }
      if (trigger === "update" && token.id) {
        const { db } = await import("./db");
        const u = await db.user.findUnique({
          where: { id: token.id as string },
          select: { mustChangePassword: true },
        });
        if (u) token.mustChangePassword = u.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as Record<string, unknown>).id = token.id;
        (session.user as unknown as Record<string, unknown>).role = token.role;
        (session.user as unknown as Record<string, unknown>).mustChangePassword = token.mustChangePassword;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/assess"];
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

      const role = (auth?.user as unknown as Record<string, unknown>)?.role as string;

      if (pathname.startsWith("/student") && role !== "STUDENT") return false;
      if (pathname.startsWith("/teacher") && role !== "TEACHER" && role !== "PRINCIPAL") return false;
      if (pathname.startsWith("/principal") && role !== "PRINCIPAL") return false;

      return true;
    },
  },
};
