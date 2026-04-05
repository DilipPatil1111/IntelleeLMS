import "./auth-types";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth-config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { db } = await import("./db");
        const bcrypt = await import("bcryptjs");

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.hashedPassword) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword
        );

        if (!isValid) return null;

        const grants = await db.userPortalGrant.findMany({
          where: { userId: user.id },
          select: { portal: true },
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          image: user.image,
          mustChangePassword: user.mustChangePassword,
          grantedPortals: grants.map((g) => g.portal),
        };
      },
    }),
  ],
});

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { db } = await import("./db");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      studentProfile: { include: { program: true, batch: true } },
      teacherProfile: { include: { subjectAssignments: { include: { subject: true, batch: true } } } },
    },
  });

  return user;
}
