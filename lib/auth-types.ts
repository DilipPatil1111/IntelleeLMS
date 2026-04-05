import { type DefaultSession } from "next-auth";

export type AppRole = "STUDENT" | "TEACHER" | "PRINCIPAL";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      /** Extra portal access from `UserPortalGrant` (primary `role` is still the main record). */
      grantedPortals?: AppRole[];
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: AppRole;
    grantedPortals?: AppRole[];
    mustChangePassword?: boolean;
  }
}
