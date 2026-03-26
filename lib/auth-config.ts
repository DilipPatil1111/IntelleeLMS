import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as unknown as Record<string, unknown>).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as Record<string, unknown>).id = token.id;
        (session.user as unknown as Record<string, unknown>).role = token.role;
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

      if (isPublic || isAuthApi) return true;
      if (!isLoggedIn) return false;

      const role = (auth?.user as unknown as Record<string, unknown>)?.role as string;

      if (pathname.startsWith("/student") && role !== "STUDENT") return false;
      if (pathname.startsWith("/teacher") && role !== "TEACHER" && role !== "PRINCIPAL") return false;
      if (pathname.startsWith("/principal") && role !== "PRINCIPAL") return false;

      return true;
    },
  },
};
