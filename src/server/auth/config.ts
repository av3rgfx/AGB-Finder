import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";
import { env } from "@/env";

// Custom RBAC roles so the admin plugin (and createUser) speak our vocabulary.
const ac = createAccessControl({ ...defaultStatements });
const roles = {
  AGENT: ac.newRole({}),
  ADMIN: ac.newRole({ ...adminAc.statements }),
};

/**
 * Better Auth — email/password, admin-provisioned accounts (no self-signup),
 * DB sessions (8h) for real revocation, RBAC via the admin plugin
 * (AGENT default, ADMIN privileged). Prisma adapter over PostgreSQL/Neon.
 */
export const auth = betterAuth({
  baseURL: env.NEXTAUTH_URL,
  secret: env.NEXTAUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // accounts are created by admins only
    minPasswordLength: 8,
  },

  user: {
    additionalFields: {
      firstName: { type: "string", required: true, input: true },
      lastName: { type: "string", required: true, input: true },
      status: { type: "string", required: false, defaultValue: "ACTIVE", input: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 8, // 8h working session
    updateAge: 60 * 60, // refresh once per hour
  },

  plugins: [
    admin({ ac, roles, defaultRole: "AGENT", adminRoles: ["ADMIN"] }),
    nextCookies(), // must be the last plugin
  ],
});

/** Inferred session type (includes role/status/firstName/lastName). */
export type AuthSession = typeof auth.$Infer.Session;
