import "server-only";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton. Reused across HMR in dev to avoid exhausting the
 * connection pool. Server-only — never import from a Client Component.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
