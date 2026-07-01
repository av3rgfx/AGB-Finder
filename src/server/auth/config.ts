import "server-only";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/env";

/** Shape of the user row `authorize` reads from the database. */
export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
}

/** The user object exposed to the JWT/session (never contains the hash). */
export interface SafeAuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
}

/** Injectable dependencies so the pure logic can be unit-tested. */
export interface AuthorizeDeps {
  findUser: (email: string) => Promise<AuthUserRecord | null>;
  compare: (password: string, hash: string) => Promise<boolean>;
}

/**
 * Pure credential-verification logic. Returns the safe user or null.
 * Only ACTIVE users with a matching bcrypt password are authorized.
 */
export async function authorizeUser(
  credentials: Partial<Record<"email" | "password", unknown>> | undefined,
  deps: AuthorizeDeps,
): Promise<SafeAuthUser | null> {
  const email = credentials?.email;
  const password = credentials?.password;
  if (typeof email !== "string" || typeof password !== "string") return null;

  const user = await deps.findUser(email);
  if (!user || user.status !== "ACTIVE") return null;

  const valid = await deps.compare(password, user.passwordHash);
  if (!valid) return null;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
  };
}

const defaultDeps: AuthorizeDeps = {
  findUser: (email) => db.user.findUnique({ where: { email } }),
  compare: (password, hash) => bcrypt.compare(password, hash),
};

/**
 * NextAuth v4 config — Credentials + JWT, NO adapter (council decision).
 * Sessions are stateless (8h); RBAC data (role/status) rides on the JWT.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60, updateAge: 60 * 60 },
  jwt: { maxAge: 8 * 60 * 60 },
  secret: env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (credentials) => authorizeUser(credentials, defaultDeps),
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.status = token.status;
        session.user.firstName = token.firstName;
        session.user.lastName = token.lastName;
      }
      return session;
    },
  },
  pages: { signIn: "/login", error: "/login" },
  events: {
    async signIn({ user }) {
      await db.activityLog.create({
        data: { type: "LOGIN", description: `Login utente ${user.email ?? ""}`, userId: user.id },
      });
    },
    async signOut({ token }) {
      const id = token?.id;
      if (id) {
        await db.activityLog.create({
          data: { type: "LOGOUT", description: "Logout utente", userId: id },
        });
      }
    },
  },
};
