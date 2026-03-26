import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "STUDENT" | "TEACHER" | "PRINCIPAL";
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "STUDENT" | "TEACHER" | "PRINCIPAL";
    mustChangePassword?: boolean;
  }
}
