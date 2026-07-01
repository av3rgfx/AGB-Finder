import type { UserRole, UserStatus } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/**
 * Augment NextAuth types with the fields our Credentials provider issues and
 * the callbacks copy onto the JWT/session. Required under TS strict mode.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      status: UserStatus;
      firstName: string;
      lastName: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: UserRole;
    status: UserStatus;
    firstName: string;
    lastName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    status: UserStatus;
    firstName: string;
    lastName: string;
  }
}
